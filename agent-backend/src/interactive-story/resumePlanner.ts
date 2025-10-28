import { InteractiveStoryError } from './errors.js';
import type {
  GenerationTask,
  SceneletRecord,
  ScriptwriterScenelet,
} from './types.js';
import { cloneScenelet, normalizeStoredSceneletContent } from './sceneletUtils.js';

export interface ResumePlannerResult {
  pendingTasks: GenerationTask[];
}

export function buildResumePlanFromScenelets(
  storyId: string,
  scenelets: SceneletRecord[]
): ResumePlannerResult {
  const trimmedStoryId = storyId?.trim();
  if (!trimmedStoryId) {
    throw new InteractiveStoryError('Story id must not be empty when planning resume.');
  }

  if (!Array.isArray(scenelets) || scenelets.length === 0) {
    return { pendingTasks: [] };
  }

  const filtered = scenelets.filter((record) => record.storyId === trimmedStoryId);

  if (filtered.length === 0) {
    return { pendingTasks: [] };
  }

  const sceneletMap = new Map<string, SceneletRecord>();
  const contentMap = new Map<string, ScriptwriterScenelet>();
  const childrenByParent = new Map<string, SceneletRecord[]>();
  const roots: SceneletRecord[] = [];

  for (const record of filtered) {
    validateSceneletRecord(record);

    if (sceneletMap.has(record.id)) {
      throw new InteractiveStoryError(
        `Duplicate scenelet id detected while planning resume: ${record.id}.`
      );
    }

    sceneletMap.set(record.id, record);
    contentMap.set(record.id, normalizeStoredSceneletContent(record.content, record.id));

    if (record.parentId === null) {
      roots.push(record);
      continue;
    }

    const list = childrenByParent.get(record.parentId);
    if (list) {
      list.push(record);
    } else {
      childrenByParent.set(record.parentId, [record]);
    }
  }

  if (roots.length === 0) {
    throw new InteractiveStoryError(
      `Cannot resume story ${trimmedStoryId}: missing root scenelet.`
    );
  }

  if (roots.length > 1) {
    const rootIds = roots.map((node) => node.id).join(', ');
    throw new InteractiveStoryError(
      `Cannot resume story ${trimmedStoryId}: multiple roots detected (${rootIds}).`
    );
  }

  for (const [parentId, children] of childrenByParent.entries()) {
    if (!sceneletMap.has(parentId)) {
      throw new InteractiveStoryError(
        `Scenelet ${parentId} referenced as parent but missing from resume dataset.`
      );
    }
    children.sort((a, b) => compareTimestamps(a.createdAt, b.createdAt));
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const pendingTasks: GenerationTask[] = [];

  traverseSceneletTree(
    roots[0]!,
    [],
    sceneletMap,
    contentMap,
    childrenByParent,
    visited,
    visiting,
    pendingTasks,
    trimmedStoryId
  );

  if (visited.size !== sceneletMap.size) {
    const orphans = [...sceneletMap.keys()].filter((id) => !visited.has(id));
    throw new InteractiveStoryError(
      `Story ${trimmedStoryId} contains orphaned scenelets: ${orphans.join(', ')}.`
    );
  }

  return {
    pendingTasks,
  };
}

function traverseSceneletTree(
  record: SceneletRecord,
  parentPathContext: ScriptwriterScenelet[],
  sceneletMap: Map<string, SceneletRecord>,
  contentMap: Map<string, ScriptwriterScenelet>,
  childrenByParent: Map<string, SceneletRecord[]>,
  visited: Set<string>,
  visiting: Set<string>,
  pendingTasks: GenerationTask[],
  storyId: string
): void {
  if (visiting.has(record.id)) {
    throw new InteractiveStoryError(`Cycle detected in story tree at scenelet ${record.id}.`);
  }

  visiting.add(record.id);
  visited.add(record.id);

  const sceneletContent = contentMap.get(record.id);
  if (!sceneletContent) {
    throw new InteractiveStoryError(
      `Scenelet ${record.id} missing normalized content during resume planning.`
    );
  }

  const pathContext = [...parentPathContext, cloneScenelet(sceneletContent)];
  const children = childrenByParent.get(record.id) ?? [];

  if (record.isTerminalNode) {
    if (children.length > 0) {
      throw new InteractiveStoryError(
        `Terminal scenelet ${record.id} cannot have child scenelets.`
      );
    }
    visiting.delete(record.id);
    return;
  }

  if (record.isBranchPoint) {
    const choicePrompt = record.choicePrompt?.toString().trim();
    if (!choicePrompt) {
      throw new InteractiveStoryError(
        `Branch scenelet ${record.id} is missing a choice prompt.`
      );
    }
    if (children.length === 0) {
      throw new InteractiveStoryError(
        `Branch scenelet ${record.id} is marked as branch point but missing child scenelets.`
      );
    }
  }

  if (children.length === 0) {
    pendingTasks.push({
      storyId,
      parentSceneletId: record.id,
      pathContext,
    });
    visiting.delete(record.id);
    return;
  }

  for (const child of children) {
    if (!sceneletMap.has(child.id)) {
      throw new InteractiveStoryError(
        `Scenelet ${child.id} missing from resume dataset while enumerating children.`
      );
    }

    if (record.isBranchPoint) {
      const label = child.choiceLabelFromParent?.toString().trim();
      if (!label) {
        throw new InteractiveStoryError(
          `Branch scenelet ${record.id} has a child without a choice label (${child.id}).`
        );
      }
    }

    traverseSceneletTree(
      child,
      pathContext,
      sceneletMap,
      contentMap,
      childrenByParent,
      visited,
      visiting,
      pendingTasks,
      storyId
    );
  }

  visiting.delete(record.id);
}

function validateSceneletRecord(record: SceneletRecord): void {
  if (!record.id || !record.id.trim()) {
    throw new InteractiveStoryError('Scenelet records must include a non-empty id.');
  }

  if (!record.storyId || !record.storyId.trim()) {
    throw new InteractiveStoryError(`Scenelet ${record.id} is missing a valid story id.`);
  }

  if (record.parentId !== null && typeof record.parentId !== 'string') {
    throw new InteractiveStoryError(
      `Scenelet ${record.id} parentId must be null or string.`
    );
  }
}

function compareTimestamps(a: string, b: string): number {
  const aTime = toTimestamp(a);
  const bTime = toTimestamp(b);
  if (aTime === bTime) {
    return 0;
  }
  return aTime - bTime;
}

function toTimestamp(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}
