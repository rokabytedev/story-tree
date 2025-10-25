import { describe, expect, it } from 'vitest';

import {
  createStoriesRepository,
  StoriesRepository,
  StoriesRepositoryError,
  StoryNotFoundError,
  StoryRecord,
} from '../src/storiesRepository.js';

interface StoryRow {
  id: string;
  display_name: string;
  display_name_upper: string | null;
  created_at: string;
  updated_at: string;
  story_constitution: unknown | null;
  interactive_script: unknown | null;
  visual_design_document: unknown | null;
  audio_design_document: unknown | null;
  visual_reference_package: unknown | null;
  storyboard_breakdown: unknown | null;
  generation_prompts: unknown | null;
}

interface FakeResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

type InsertArgs = Partial<StoryRow>;

interface FakeResponses {
  insert?: FakeResponse<StoryRow>;
  update?: FakeResponse<StoryRow>;
  selectSingle?: FakeResponse<StoryRow>;
  selectMany?: FakeResponse<StoryRow[]>;
  delete?: FakeResponse<StoryRow>;
}

class FakeStoriesTable {
  public readonly inserted: InsertArgs[] = [];
  public readonly updated: InsertArgs[] = [];
  public readonly updateFilters: Array<{ column: string; value: string }> = [];
  public readonly selectFilters: Array<{ column: string; value: string }> = [];
  public readonly deleteFilters: Array<{ column: string; value: string }> = [];

  constructor(private readonly responses: FakeResponses) {}

  insert(values: InsertArgs) {
    this.inserted.push(values);
    const response = this.responses.insert ?? { data: null, error: null };
    return {
      select: () => ({
        single: async (): Promise<FakeResponse<StoryRow>> => response,
      }),
    };
  }

  update(values: InsertArgs) {
    this.updated.push(values);
    return {
      eq: (column: string, value: string) => {
        this.updateFilters.push({ column, value });
        const response = this.responses.update ?? { data: null, error: null };
        return {
          select: () => ({
            maybeSingle: async (): Promise<FakeResponse<StoryRow>> => response,
          }),
        };
      },
    };
  }

  select() {
    const singleResponse = this.responses.selectSingle ?? { data: null, error: null };
    const manyResponse = this.responses.selectMany ?? { data: [], error: null };

    const promise = Promise.resolve(manyResponse);

    const builder: any = {
      eq: (column: string, value: string) => {
        this.selectFilters.push({ column, value });
        return {
          maybeSingle: async (): Promise<FakeResponse<StoryRow>> => singleResponse,
        };
      },
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally?.bind(promise),
    };

    return builder;
  }

  delete() {
    return {
      eq: (column: string, value: string) => {
        this.deleteFilters.push({ column, value });
        const response = this.responses.delete ?? { data: null, error: null };
        return {
          select: () => ({
            maybeSingle: async (): Promise<FakeResponse<StoryRow>> => response,
          }),
        };
      },
    };
  }
}

class FakeSupabaseClient {
  public lastTableRequested: string | null = null;

  constructor(private readonly table: FakeStoriesTable) {}

  from(table: string) {
    this.lastTableRequested = table;
    return this.table;
  }
}

function makeRepository(responses: FakeResponses): {
  repo: StoriesRepository;
  table: FakeStoriesTable;
  client: FakeSupabaseClient;
} {
  const table = new FakeStoriesTable(responses);
  const client = new FakeSupabaseClient(table);
  const repo = createStoriesRepository(client as unknown as any);
  return { repo, table, client };
}

function makeStoryRow(overrides: Partial<StoryRow> = {}): StoryRow {
  const base: StoryRow = {
    id: '3b177127-2f46-4cb0-9cc9-0b0b891ee7de',
    display_name: 'Galactic Garden',
    display_name_upper: 'GALACTIC GARDEN',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    story_constitution: { title: 'Galactic Garden' },
    interactive_script: { scenelets: [] },
    visual_design_document: { characters: [] },
    audio_design_document: { sonic_identity: {} },
    visual_reference_package: { character_model_sheets: [] },
    storyboard_breakdown: { shots: [] },
    generation_prompts: { prompts: [] },
  };

  return { ...base, ...overrides };
}

describe('storiesRepository.createStory', () => {
  it('inserts a story and returns the saved record', async () => {
    const insertedRow = makeStoryRow({
      display_name: 'New Story',
      story_constitution: { title: 'New Story' },
    });
    const { repo, table, client } = makeRepository({
      insert: { data: insertedRow, error: null },
    });

    const result = await repo.createStory({
      displayName: 'New Story',
      storyConstitution: { title: 'New Story' },
    });

    expect(client.lastTableRequested).toBe('stories');
    expect(table.inserted).toHaveLength(1);
    expect(table.inserted[0]).toMatchObject({
      display_name: 'New Story',
      story_constitution: { title: 'New Story' },
    });
    expect(result.displayName).toBe('New Story');
    expect(result.id).toBe(insertedRow.id);
    expect(result.storyConstitution).toEqual({ title: 'New Story' });
  });

  it('throws StoriesRepositoryError when insert fails', async () => {
    const { repo } = makeRepository({
      insert: { data: null, error: { message: 'constraint violation', code: '23505' } },
    });

    await expect(
      repo.createStory({ displayName: 'Broken Story' })
    ).rejects.toBeInstanceOf(StoriesRepositoryError);
  });
});

describe('storiesRepository.updateStoryArtifacts', () => {
  it('updates provided JSON fields and returns the saved row', async () => {
    const updatedRow = makeStoryRow({
      story_constitution: { title: 'Alpha' },
      visual_design_document: { characters: ['Hero'] },
      audio_design_document: { voices: [] },
    });
    const { repo, table } = makeRepository({
      update: { data: updatedRow, error: null },
    });

    const result = await repo.updateStoryArtifacts(updatedRow.id, {
      visualDesignDocument: { characters: ['Hero'] },
      audioDesignDocument: { voices: [] },
    });

    expect(table.updated).toHaveLength(1);
    expect(table.updated[0]).toMatchObject({
      visual_design_document: { characters: ['Hero'] },
      audio_design_document: { voices: [] },
    });
    expect(table.updateFilters).toEqual([
      { column: 'id', value: updatedRow.id },
    ]);
    expect(result.id).toBe(updatedRow.id);
    expect(result.visualDesignDocument).toEqual({ characters: ['Hero'] });
    expect(result.audioDesignDocument).toEqual({ voices: [] });
  });

  it('throws StoryNotFoundError when the row is missing', async () => {
    const { repo } = makeRepository({
      update: { data: null, error: null },
    });

    await expect(
      repo.updateStoryArtifacts('missing-id', {
        visualDesignDocument: { characters: [] },
      })
    ).rejects.toBeInstanceOf(StoryNotFoundError);
  });

  it('throws StoriesRepositoryError when update returns an error', async () => {
    const { repo } = makeRepository({
      update: { data: null, error: { message: 'permission denied', code: '42501' } },
    });

    await expect(
      repo.updateStoryArtifacts('story-id', {
        storyConstitution: { title: 'Broken' },
      })
    ).rejects.toBeInstanceOf(StoriesRepositoryError);
  });
});

describe('storiesRepository.getStoryById', () => {
  it('returns a mapped StoryRecord when the row exists', async () => {
    const row = makeStoryRow({ display_name: 'Existing Story' });
    const { repo, table } = makeRepository({
      selectSingle: { data: row, error: null },
    });

    const result = await repo.getStoryById(row.id);

    expect(table.selectFilters).toEqual([
      { column: 'id', value: row.id },
    ]);
    expect(result).not.toBeNull();
    expect((result as StoryRecord).displayName).toBe('Existing Story');
  });

  it('returns null when the row does not exist', async () => {
    const { repo } = makeRepository({
      selectSingle: { data: null, error: null },
    });

    const result = await repo.getStoryById('missing');
    expect(result).toBeNull();
  });

  it('throws StoriesRepositoryError when select fails', async () => {
    const { repo } = makeRepository({
      selectSingle: { data: null, error: { message: 'network issue' } },
    });

    await expect(repo.getStoryById('oops')).rejects.toBeInstanceOf(StoriesRepositoryError);
  });
});

describe('storiesRepository.deleteStoryById', () => {
  it('deletes a story and resolves', async () => {
    const row = makeStoryRow();
    const { repo, table } = makeRepository({
      delete: { data: row, error: null },
    });

    await expect(repo.deleteStoryById(row.id)).resolves.toBeUndefined();
    expect(table.deleteFilters).toEqual([{ column: 'id', value: row.id }]);
  });

  it('throws StoryNotFoundError when the story is missing', async () => {
    const { repo } = makeRepository({
      delete: { data: null, error: null },
    });

    await expect(repo.deleteStoryById('missing-id')).rejects.toBeInstanceOf(StoryNotFoundError);
  });

  it('throws StoriesRepositoryError when delete fails', async () => {
    const { repo } = makeRepository({
      delete: { data: null, error: { message: 'permission denied' } },
    });

    await expect(repo.deleteStoryById('story-id')).rejects.toBeInstanceOf(StoriesRepositoryError);
  });
});

describe('storiesRepository.listStories', () => {
  it('returns mapped StoryRecords for all rows', async () => {
    const rows = [
      makeStoryRow({ id: 'id-1', display_name: 'Story One' }),
      makeStoryRow({ id: 'id-2', display_name: 'Story Two' }),
    ];

    const { repo } = makeRepository({
      selectMany: { data: rows, error: null },
    });

    const result = await repo.listStories();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'id-1', displayName: 'Story One' });
    expect(result[1]).toMatchObject({ id: 'id-2', displayName: 'Story Two' });
  });

  it('throws StoriesRepositoryError when listing fails', async () => {
    const { repo } = makeRepository({
      selectMany: { data: null, error: { message: 'permission denied' } },
    });

    await expect(repo.listStories()).rejects.toBeInstanceOf(StoriesRepositoryError);
  });
});
