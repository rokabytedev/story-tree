import { describe, expect, it } from 'vitest';

import {
  createSceneletsRepository,
  CreateSceneletInput,
  SceneletNotFoundError,
  SceneletsRepository,
  SceneletsRepositoryError,
} from '../src/sceneletsRepository.js';

type SceneletRow = {
  id: string;
  story_id: string;
  parent_id: string | null;
  choice_label_from_parent: string | null;
  choice_prompt: string | null;
  content: unknown;
  is_branch_point: boolean;
  is_terminal_node: boolean;
  created_at: string;
};

interface FakeResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface FakeResponses {
  insert?: FakeResponse<SceneletRow>;
  markBranch?: FakeResponse<SceneletRow>;
  markTerminal?: FakeResponse<SceneletRow>;
  hasScenelets?: FakeResponse<SceneletRow[]>;
}

type InsertArgs = Partial<SceneletRow>;

type UpdateArgs = Partial<SceneletRow>;

class FakeSceneletsTable {
  public readonly inserted: InsertArgs[] = [];
  public readonly updated: UpdateArgs[] = [];
  public readonly filters: Array<{ column: string; value: string }> = [];

  constructor(private readonly responses: FakeResponses) {}

  insert(values: InsertArgs) {
    this.inserted.push(values);
    const response = this.responses.insert ?? { data: null, error: null };
    return {
      select: () => ({
        single: async (): Promise<FakeResponse<SceneletRow>> => response,
      }),
    };
  }

  update(values: UpdateArgs) {
    this.updated.push(values);

    return {
      eq: (column: string, value: string) => {
        this.filters.push({ column, value });
        const response = resolveUpdateResponse(values, this.responses);
        return {
          select: () => ({
            maybeSingle: async (): Promise<FakeResponse<SceneletRow>> => response,
          }),
        };
      },
    };
  }

  select() {
    return {
      eq: (column: string, value: string) => {
        this.filters.push({ column, value });
        const response = this.responses.hasScenelets ?? { data: [], error: null };
        return {
          limit: async () => response,
        };
      },
    };
  }

  delete() {
    throw new Error('delete not implemented in fake');
  }
}

function resolveUpdateResponse(
  values: UpdateArgs,
  responses: FakeResponses
): FakeResponse<SceneletRow> {
  if (values.is_branch_point === true) {
    return responses.markBranch ?? { data: null, error: null };
  }

  if (values.is_terminal_node === true) {
    return responses.markTerminal ?? { data: null, error: null };
  }

  return { data: null, error: { message: 'unexpected update' } };
}

class FakeSupabaseClient {
  constructor(private readonly table: FakeSceneletsTable) {}

  from() {
    return this.table;
  }
}

function makeSceneletRow(overrides: Partial<SceneletRow> = {}): SceneletRow {
  return {
    id: overrides.id ?? 'scenelet-id',
    story_id: overrides.story_id ?? 'story-id',
    parent_id: overrides.parent_id ?? null,
    choice_label_from_parent: overrides.choice_label_from_parent ?? null,
    choice_prompt: overrides.choice_prompt ?? null,
    content: overrides.content ?? { description: 'Stub' },
    is_branch_point: overrides.is_branch_point ?? false,
    is_terminal_node: overrides.is_terminal_node ?? false,
    created_at: overrides.created_at ?? '2025-01-01T00:00:00.000Z',
  };
}

function makeRepository(responses: FakeResponses): {
  repo: SceneletsRepository;
  table: FakeSceneletsTable;
} {
  const table = new FakeSceneletsTable(responses);
  const client = new FakeSupabaseClient(table) as any;
  const repo = createSceneletsRepository(client);
  return { repo, table };
}

describe('sceneletsRepository.createScenelet', () => {
  it('inserts a scenelet and returns mapped record', async () => {
    const row = makeSceneletRow({ parent_id: 'parent-id', choice_label_from_parent: 'Explore' });
    const { repo, table } = makeRepository({
      insert: { data: row, error: null },
    });

    const input: CreateSceneletInput = {
      storyId: 'story-id',
      parentId: 'parent-id',
      choiceLabelFromParent: 'Explore',
      content: { description: 'Next scene', dialogue: [], shot_suggestions: [] },
    };

    const record = await repo.createScenelet(input);

    expect(table.inserted).toHaveLength(1);
    expect(table.inserted[0]).toMatchObject({
      story_id: 'story-id',
      parent_id: 'parent-id',
      choice_label_from_parent: 'Explore',
    });
    expect(record.id).toBe(row.id);
    expect(record.choiceLabelFromParent).toBe('Explore');
  });

  it('throws when story id is empty', async () => {
    const { repo } = makeRepository({});

    await expect(
      repo.createScenelet({
        storyId: '  ',
        parentId: null,
        content: {},
      })
    ).rejects.toBeInstanceOf(SceneletsRepositoryError);
  });

  it('throws when supabase returns an error', async () => {
    const { repo } = makeRepository({
      insert: { data: null, error: { message: 'permission denied' } },
    });

    await expect(
      repo.createScenelet({
        storyId: 'story-id',
        parentId: null,
        content: {},
      })
    ).rejects.toBeInstanceOf(SceneletsRepositoryError);
  });
});

describe('sceneletsRepository.markSceneletAsBranchPoint', () => {
  it('marks a scenelet as branch point', async () => {
    const row = makeSceneletRow({
      id: 'scenelet-id',
      is_branch_point: true,
      choice_prompt: 'What happens next?',
    });
    const { repo, table } = makeRepository({
      markBranch: { data: row, error: null },
    });

    const record = await repo.markSceneletAsBranchPoint('scenelet-id', 'What happens next?');

    expect(table.updated).toHaveLength(1);
    expect(table.updated[0]).toMatchObject({
      is_branch_point: true,
      choice_prompt: 'What happens next?',
    });
    expect(table.filters).toEqual([{ column: 'id', value: 'scenelet-id' }]);
    expect(record.isBranchPoint).toBe(true);
    expect(record.choicePrompt).toBe('What happens next?');
  });

  it('throws when scenelet missing', async () => {
    const { repo } = makeRepository({
      markBranch: { data: null, error: null },
    });

    await expect(
      repo.markSceneletAsBranchPoint('scenelet-id', 'Question')
    ).rejects.toBeInstanceOf(SceneletNotFoundError);
  });

  it('throws when Supabase returns an error', async () => {
    const { repo } = makeRepository({
      markBranch: { data: null, error: { message: 'permission denied' } },
    });

    await expect(
      repo.markSceneletAsBranchPoint('scenelet-id', 'Question')
    ).rejects.toBeInstanceOf(SceneletsRepositoryError);
  });
});

describe('sceneletsRepository.hasSceneletsForStory', () => {
  it('returns true when scenelets exist', async () => {
    const { repo, table } = makeRepository({
      hasScenelets: { data: [makeSceneletRow()], error: null },
    });

    const result = await repo.hasSceneletsForStory('story-id');

    expect(result).toBe(true);
    expect(table.filters).toContainEqual({ column: 'story_id', value: 'story-id' });
  });

  it('returns false when no scenelets exist', async () => {
    const { repo } = makeRepository({
      hasScenelets: { data: [], error: null },
    });

    const result = await repo.hasSceneletsForStory('story-id');
    expect(result).toBe(false);
  });

  it('throws when supabase returns an error', async () => {
    const { repo } = makeRepository({
      hasScenelets: { data: null, error: { message: 'query failed' } },
    });

    await expect(repo.hasSceneletsForStory('story-id')).rejects.toBeInstanceOf(
      SceneletsRepositoryError
    );
  });

  it('throws when story id missing', async () => {
    const { repo } = makeRepository({});

    await expect(repo.hasSceneletsForStory('  ')).rejects.toBeInstanceOf(SceneletsRepositoryError);
  });
});

describe('sceneletsRepository.markSceneletAsTerminal', () => {
  it('marks a scenelet as terminal', async () => {
    const row = makeSceneletRow({ is_terminal_node: true });
    const { repo, table } = makeRepository({
      markTerminal: { data: row, error: null },
    });

    const record = await repo.markSceneletAsTerminal('scenelet-id');

    expect(table.updated).toHaveLength(1);
    expect(table.updated[0]).toMatchObject({ is_terminal_node: true });
    expect(record.isTerminalNode).toBe(true);
  });

  it('throws when terminal scenelet missing', async () => {
    const { repo } = makeRepository({
      markTerminal: { data: null, error: null },
    });

    await expect(repo.markSceneletAsTerminal('scenelet-id')).rejects.toBeInstanceOf(
      SceneletNotFoundError
    );
  });

  it('throws when Supabase returns an error', async () => {
    const { repo } = makeRepository({
      markTerminal: { data: null, error: { message: 'permission denied' } },
    });

    await expect(repo.markSceneletAsTerminal('scenelet-id')).rejects.toBeInstanceOf(
      SceneletsRepositoryError
    );
  });
});
