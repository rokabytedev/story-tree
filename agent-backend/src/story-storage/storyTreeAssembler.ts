import { StoryTreeAssemblyError } from './errors.js';
import type {
  BranchingPointDigest,
  DialogueDigestLine,
  SceneletDigest,
  SceneletRole,
  StoryTreeEntry,
  StoryTreeSceneletSource,
  StoryTreeSnapshot,
} from './types.js';

export function assembleStoryTreeSnapshot(
  scenelets: StoryTreeSceneletSource[]
): StoryTreeSnapshot {
  if (!Array.isArray(scenelets) || scenelets.length === 0) {
    throw new StoryTreeAssemblyError('Story tree requires at least one scenelet.');
  }

  const nodeMap = new Map<string, StoryTreeSceneletSource>();
  for (const scenelet of scenelets) {
    if (!scenelet || typeof scenelet.id !== 'string' || !scenelet.id.trim()) {
      throw new StoryTreeAssemblyError('Scenelet id must be a non-empty string.');
    }
    if (nodeMap.has(scenelet.id)) {
      throw new StoryTreeAssemblyError(`Duplicate scenelet id detected: ${scenelet.id}.`);
    }
    nodeMap.set(scenelet.id, scenelet);
  }

  const childrenByParent = new Map<string, StoryTreeSceneletSource[]>();
  const roots: StoryTreeSceneletSource[] = [];

  for (const scenelet of nodeMap.values()) {
    if (scenelet.parentId === null) {
      roots.push(scenelet);
      continue;
    }

    const parent = nodeMap.get(scenelet.parentId);
    if (!parent) {
      throw new StoryTreeAssemblyError(
        `Scenelet ${scenelet.id} references missing parent ${scenelet.parentId}.`
      );
    }

    const list = childrenByParent.get(parent.id);
    if (list) {
      list.push(scenelet);
    } else {
      childrenByParent.set(parent.id, [scenelet]);
    }
  }

  if (roots.length === 0) {
    throw new StoryTreeAssemblyError('Story tree is missing a root scenelet.');
  }

  if (roots.length > 1) {
    const rootIds = roots.map((scenelet) => scenelet.id).join(', ');
    throw new StoryTreeAssemblyError(
      `Story tree must have exactly one root scenelet. Found: ${rootIds}.`
    );
  }

  for (const list of childrenByParent.values()) {
    list.sort(compareSceneletTraversalOrder);
  }

  const sceneletIds = new Map<string, string>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  let sceneletCounter = 0;

  function assignSceneletIds(node: StoryTreeSceneletSource): void {
    if (visiting.has(node.id)) {
      throw new StoryTreeAssemblyError(`Cycle detected in story tree at scenelet ${node.id}.`);
    }

    visiting.add(node.id);
    visited.add(node.id);
    sceneletCounter += 1;
    sceneletIds.set(node.id, `scenelet-${sceneletCounter}`);

    const children = childrenByParent.get(node.id) ?? [];
    for (const child of children) {
      assignSceneletIds(child);
    }

    visiting.delete(node.id);
  }

  const root = roots[0]!;
  assignSceneletIds(root);

  if (visited.size !== nodeMap.size) {
    const orphans = [...nodeMap.keys()].filter((id) => !visited.has(id));
    throw new StoryTreeAssemblyError(
      `Story tree contains orphaned scenelets: ${orphans.join(', ')}.`
    );
  }

  const entries: StoryTreeEntry[] = [];
  let branchingCounter = 0;

  function emitEntries(
    node: StoryTreeSceneletSource,
    parent: StoryTreeSceneletSource | null
  ): void {
    const assignedId = sceneletIds.get(node.id);
    if (!assignedId) {
      throw new StoryTreeAssemblyError(`Scenelet ${node.id} missing assigned identifier.`);
    }

    const parentAssignedId = parent ? sceneletIds.get(parent.id) ?? null : null;
    const role = determineSceneletRole(node, parent);
    const content = normalizeSceneletContent(node.content);

    const digest: SceneletDigest = {
      id: assignedId,
      parentId: parentAssignedId,
      role,
      description: content.description,
      dialogue: content.dialogue,
      shotSuggestions: content.shotSuggestions,
    };

    if (parent?.isBranchPoint) {
      const label = normalizeChoiceLabel(node.choiceLabelFromParent);
      if (!label) {
        throw new StoryTreeAssemblyError(
          `Scenelet ${node.id} is missing a choice label from branch parent ${parent.id}.`
        );
      }
      digest.choiceLabel = label;
    }

    entries.push({ kind: 'scenelet', data: digest });

    const children = childrenByParent.get(node.id) ?? [];

    if (node.isBranchPoint) {
      const choicePrompt = normalizeChoicePrompt(node.choicePrompt);
      if (!choicePrompt) {
        throw new StoryTreeAssemblyError(
          `Branch point scenelet ${node.id} is missing a choice prompt.`
        );
      }
      if (children.length === 0) {
        throw new StoryTreeAssemblyError(
          `Branch point scenelet ${node.id} must include at least one child scenelet.`
        );
      }

      branchingCounter += 1;
      const branchingId = `branching-point-${branchingCounter}`;
      const choices = children.map((child) => {
        const leadsTo = sceneletIds.get(child.id);
        if (!leadsTo) {
          throw new StoryTreeAssemblyError(
            `Branch point ${node.id} references child ${child.id} without an assigned id.`
          );
        }

        const label = normalizeChoiceLabel(child.choiceLabelFromParent);
        if (!label) {
          throw new StoryTreeAssemblyError(
            `Branch point ${node.id} has a child without a choice label: ${child.id}.`
          );
        }

        return {
          label,
          leadsTo,
        };
      });

      const branchDigest: BranchingPointDigest = {
        id: branchingId,
        sourceSceneletId: assignedId,
        choicePrompt,
        choices,
      };

      entries.push({ kind: 'branching-point', data: branchDigest });
    }

    for (const child of children) {
      emitEntries(child, node);
    }
  }

  emitEntries(root, null);
  const yaml = renderStoryTreeYaml(entries);

  return {
    entries,
    yaml,
  };
}

function compareSceneletTraversalOrder(
  a: StoryTreeSceneletSource,
  b: StoryTreeSceneletSource
): number {
  const aTime = parseTimestamp(basicString(a.createdAt));
  const bTime = parseTimestamp(basicString(b.createdAt));

  if (aTime !== bTime) {
    return bTime - aTime; // descending so newer timestamps (created later) appear first
  }

  return a.id.localeCompare(b.id);
}

function determineSceneletRole(
  node: StoryTreeSceneletSource,
  parent: StoryTreeSceneletSource | null
): SceneletRole {
  if (!parent) {
    return 'root';
  }

  if (node.isTerminalNode) {
    return 'terminal';
  }

  if (parent.isBranchPoint) {
    return 'branch';
  }

  return 'linear';
}

interface NormalizedSceneletContent {
  description: string;
  dialogue: DialogueDigestLine[];
  shotSuggestions: string[];
}

function normalizeSceneletContent(content: unknown): NormalizedSceneletContent {
  if (!content || typeof content !== 'object') {
    return {
      description: '',
      dialogue: [],
      shotSuggestions: [],
    };
  }

  const record = content as Record<string, unknown>;
  const description = basicString(record.description ?? record['description']) ?? '';
  const dialogueRaw = Array.isArray(record.dialogue) ? record.dialogue : [];
  const dialogue: DialogueDigestLine[] = [];

  for (const entry of dialogueRaw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const character = basicString(row.character ?? row['character']);
    const line = basicString(row.line ?? row['line']);
    if (character !== null && line !== null) {
      dialogue.push({ character, line });
    }
  }

  const shotRaw = Array.isArray(record.shot_suggestions)
    ? record.shot_suggestions
    : Array.isArray(record.shotSuggestions)
      ? record.shotSuggestions
      : [];
  const shotSuggestions = shotRaw
    .map((entry) => basicString(entry))
    .filter((value): value is string => value !== null);

  return {
    description,
    dialogue,
    shotSuggestions,
  };
}

function normalizeChoiceLabel(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function normalizeChoicePrompt(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function parseTimestamp(value: string | null): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return Number.NEGATIVE_INFINITY;
  }

  return parsed;
}

function renderStoryTreeYaml(entries: StoryTreeEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    if (entry.kind === 'scenelet') {
      lines.push(...renderSceneletEntry(entry.data));
    } else {
      lines.push(...renderBranchingEntry(entry.data));
    }
  }

  return lines.join('\n');
}

function renderSceneletEntry(scenelet: SceneletDigest): string[] {
  const lines: string[] = [`- ${scenelet.id}:`];
  const indent = '  ';

  if (scenelet.role !== 'linear') {
    lines.push(`${indent}role: ${scenelet.role}`);
  }

  const label = scenelet.choiceLabel?.trim?.();
  if (label) {
    lines.push(`${indent}choice_label: ${formatYamlString(label)}`);
  }

  lines.push(`${indent}description: ${formatYamlString(scenelet.description)}`);
  lines.push(...renderDialogueBlock(scenelet.dialogue, indent));
  lines.push(...renderShotSuggestionsBlock(scenelet.shotSuggestions, indent));

  return lines;
}

function renderBranchingEntry(branch: BranchingPointDigest): string[] {
  const lines: string[] = [`- ${branch.id}:`];
  const indent = '  ';

  lines.push(`${indent}choice_prompt: ${formatYamlString(branch.choicePrompt)}`);

  if (branch.choices.length === 0) {
    lines.push(`${indent}choices: []`);
    return lines;
  }

  lines.push(`${indent}choices:`);
  for (const choice of branch.choices) {
    lines.push(`${indent}  - label: ${formatYamlString(choice.label)}`);
    lines.push(`${indent}    leads_to: ${choice.leadsTo}`);
  }

  return lines;
}

function renderDialogueBlock(dialogue: DialogueDigestLine[], indent: string): string[] {
  if (dialogue.length === 0) {
    return [`${indent}dialogue: []`];
  }

  const lines = [`${indent}dialogue:`];
  for (const line of dialogue) {
    lines.push(`${indent}  - character: ${formatYamlString(line.character)}`);
    lines.push(`${indent}    line: ${formatYamlString(line.line)}`);
  }
  return lines;
}

function renderShotSuggestionsBlock(suggestions: string[], indent: string): string[] {
  if (suggestions.length === 0) {
    return [`${indent}shot_suggestions: []`];
  }

  const lines = [`${indent}shot_suggestions:`];
  for (const suggestion of suggestions) {
    lines.push(`${indent}  - ${formatYamlString(suggestion)}`);
  }
  return lines;
}

function formatYamlString(value: string): string {
  if (!value) {
    return '""';
  }

  const needsBlock = value.includes('\n');
  if (!needsBlock) {
    return JSON.stringify(value);
  }

  const segments = value.split('\n');
  const indented = segments.map((segment) => `      ${segment}`).join('\n');
  return `|\n${indented}`;
}

function basicString(input: unknown): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : '';
  }
  return null;
}

export { renderStoryTreeYaml };
