import { describe, expect, it } from 'vitest';

import { buildResumePlanFromScenelets } from '../src/interactive-story/resumePlanner.js';
import type { SceneletRecord } from '../src/interactive-story/types.js';
import { InteractiveStoryError } from '../src/interactive-story/errors.js';

function createSceneletRecord(overrides: Partial<SceneletRecord> & {
  id: string;
  storyId: string;
}): SceneletRecord {
  return {
    parentId: overrides.parentId ?? null,
    choiceLabelFromParent: overrides.choiceLabelFromParent ?? null,
    choicePrompt: overrides.choicePrompt ?? null,
    content:
      overrides.content ??
      {
        description: `Scenelet ${overrides.id}`,
        dialogue: [{ character: 'Narrator', line: 'Line' }],
        shot_suggestions: ['Shot'],
      },
    isBranchPoint: overrides.isBranchPoint ?? false,
    isTerminalNode: overrides.isTerminalNode ?? false,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

describe('buildResumePlanFromScenelets', () => {
  it('returns pending tasks for unfinished leaves', () => {
    const storyId = 'story-resume';
    const root = createSceneletRecord({
      id: 'scenelet-root',
      storyId,
      parentId: null,
      content: {
        description: 'Root scene',
        dialogue: [],
        shot_suggestions: ['Root shot'],
      },
    });
    const leaf = createSceneletRecord({
      id: 'scenelet-leaf',
      storyId,
      parentId: root.id,
      content: {
        description: 'Leaf scene',
        dialogue: [],
        shot_suggestions: ['Leaf shot'],
      },
    });

    const plan = buildResumePlanFromScenelets(storyId, [root, leaf]);
    expect(plan.pendingTasks).toHaveLength(1);
    const task = plan.pendingTasks[0]!;
    expect(task.parentSceneletId).toBe('scenelet-leaf');
    expect(task.pathContext).toHaveLength(2);
    expect(task.pathContext[0]?.description).toBe('Root scene');
    expect(task.pathContext[1]?.description).toBe('Leaf scene');
  });

  it('returns empty tasks when all leaves are terminal', () => {
    const storyId = 'story-complete';
    const root = createSceneletRecord({
      id: 'scenelet-root',
      storyId,
      isTerminalNode: true,
      parentId: null,
    });

    const plan = buildResumePlanFromScenelets(storyId, [root]);
    expect(plan.pendingTasks).toHaveLength(0);
  });

  it('throws when branch node is missing children', () => {
    const storyId = 'story-error';
    const branch = createSceneletRecord({
      id: 'scenelet-branch',
      storyId,
      isBranchPoint: true,
      choicePrompt: 'Choose wisely',
    });

    expect(() => buildResumePlanFromScenelets(storyId, [branch])).toThrow(InteractiveStoryError);
  });

  it('throws when multiple roots exist', () => {
    const storyId = 'story-multi-root';
    const firstRoot = createSceneletRecord({
      id: 'scenelet-root-1',
      storyId,
      parentId: null,
    });
    const secondRoot = createSceneletRecord({
      id: 'scenelet-root-2',
      storyId,
      parentId: null,
    });

    expect(() =>
      buildResumePlanFromScenelets(storyId, [firstRoot, secondRoot])
    ).toThrow(InteractiveStoryError);
  });
});
