import { describe, expect, it } from 'vitest';

import {
  createShotsRepository,
  SceneletShotsAlreadyExistError,
  ShotsRepository,
  ShotsRepositoryError,
} from '../src/shotsRepository.js';

type ShotRow = {
  id: string;
  story_id: string;
  scenelet_id: string;
  scenelet_sequence: number;
  shot_index: number;
  storyboard_payload: unknown;
  first_frame_prompt: string;
  key_frame_prompt: string;
  video_clip_prompt: string;
  created_at: string;
  updated_at: string;
};

type SelectFilters =
  | { type: 'eq'; column: string; value: string | number }
  | { type: 'in'; column: string; values: string[] };

interface FakeResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface FakeResponses {
  selectExisting?: FakeResponse<Array<Pick<ShotRow, 'id'>>>;
  selectStoryShots?: FakeResponse<ShotRow[]>;
  selectSceneletIds?: FakeResponse<Array<{ scenelet_id: string }>>;
  insert?: FakeResponse<ShotRow[]>;
}

class FakeShotsTable {
  public readonly inserted: Array<Record<string, unknown>>[] = [];
  public readonly selectCalls: Array<{
    columns?: string;
    filters: SelectFilters[];
    order: Array<{ column: string; ascending: boolean }>;
  }> = [];

  constructor(private readonly responses: FakeResponses) {}

  insert(rows: Array<Record<string, unknown>>) {
    this.inserted.push(rows);
    const response = this.responses.insert ?? { data: rows as ShotRow[], error: null };
    return Promise.resolve(response);
  }

  select(columns?: string) {
    const context = {
      columns,
      filters: [] as SelectFilters[],
      order: [] as Array<{ column: string; ascending: boolean }>,
    };

    const response = resolveSelectResponse(columns, this.responses);
    const promise = Promise.resolve(response);

    const builder: any = {
      eq: (column: string, value: string | number) => {
        context.filters.push({ type: 'eq', column, value });
        return builder;
      },
      in: (column: string, values: string[]) => {
        context.filters.push({ type: 'in', column, values });
        return builder;
      },
      order: (column: string, options: { ascending: boolean }) => {
        context.order.push({ column, ascending: options.ascending });
        return builder;
      },
      limit: (_value: number) => builder,
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally?.bind(promise),
    };

    this.selectCalls.push(context);
    return builder;
  }
}

function resolveSelectResponse(
  columns: string | undefined,
  responses: FakeResponses
): FakeResponse<any> {
  if (columns === 'id') {
    return responses.selectExisting ?? { data: [], error: null };
  }

  if (columns === 'scenelet_id') {
    return responses.selectSceneletIds ?? { data: [], error: null };
  }

  return responses.selectStoryShots ?? { data: [], error: null };
}

class FakeSupabaseClient {
  public lastTableRequested: string | null = null;

  constructor(private readonly table: FakeShotsTable) {}

  from(table: string) {
    this.lastTableRequested = table;
    return this.table;
  }
}

function makeShotRow(overrides: Partial<ShotRow> = {}): ShotRow {
  return {
    id: overrides.id ?? '9a8fe1f3-1d0e-4d0e-9cce-847275b82a4d',
    story_id: overrides.story_id ?? 'story-123',
    scenelet_id: overrides.scenelet_id ?? 'scenelet-1',
    scenelet_sequence: overrides.scenelet_sequence ?? 1,
    shot_index: overrides.shot_index ?? 1,
    storyboard_payload: overrides.storyboard_payload ?? { framing_and_angle: 'Wide' },
    first_frame_prompt: overrides.first_frame_prompt ?? 'First frame prompt',
    key_frame_prompt: overrides.key_frame_prompt ?? 'Key frame prompt',
    video_clip_prompt: overrides.video_clip_prompt ?? 'Video clip prompt. No background music.',
    created_at: overrides.created_at ?? '2025-01-01T00:00:00.000Z',
    updated_at: overrides.updated_at ?? '2025-01-01T00:00:00.000Z',
  };
}

function makeRepository(responses: FakeResponses): {
  repo: ShotsRepository;
  table: FakeShotsTable;
  client: FakeSupabaseClient;
} {
  const table = new FakeShotsTable(responses);
  const client = new FakeSupabaseClient(table);
  const repo = createShotsRepository(client as any);
  return { repo, table, client };
}

describe('shotsRepository.getShotsByStory', () => {
  it('groups shots by scenelet in shot order', async () => {
    const rows = [
      makeShotRow({ scenelet_id: 'scenelet-1', shot_index: 2 }),
      makeShotRow({ scenelet_id: 'scenelet-1', shot_index: 1 }),
      makeShotRow({ scenelet_id: 'scenelet-2', shot_index: 1, scenelet_sequence: 3 }),
    ];

    const { repo, table } = makeRepository({
      selectStoryShots: { data: rows, error: null },
    });

    const result = await repo.getShotsByStory('story-123');

    expect(table.selectCalls[0]).toMatchObject({
      columns: undefined,
      filters: [{ type: 'eq', column: 'story_id', value: 'story-123' }],
      order: [
        { column: 'scenelet_sequence', ascending: true },
        { column: 'shot_index', ascending: true },
      ],
    });

    expect(Object.keys(result)).toEqual(['scenelet-1', 'scenelet-2']);
    expect(result['scenelet-1'][0]).toMatchObject({ shotIndex: 1 });
    expect(result['scenelet-1'][1]).toMatchObject({ shotIndex: 2 });
    expect(result['scenelet-2'][0]).toMatchObject({ sceneletSequence: 3 });
  });

  it('returns an empty record when no shots exist', async () => {
    const { repo } = makeRepository({
      selectStoryShots: { data: [], error: null },
    });

    const result = await repo.getShotsByStory('story-123');
    expect(result).toEqual({});
  });

  it('throws when story id is blank', async () => {
    const { repo } = makeRepository({});

    await expect(repo.getShotsByStory('  ')).rejects.toBeInstanceOf(ShotsRepositoryError);
  });

  it('throws when Supabase returns an error', async () => {
    const { repo } = makeRepository({
      selectStoryShots: { data: null, error: { message: 'permission denied' } },
    });

    await expect(repo.getShotsByStory('story-123')).rejects.toBeInstanceOf(ShotsRepositoryError);
  });
});

describe('shotsRepository.createSceneletShots', () => {
  it('inserts all shots when none exist for the scenelet', async () => {
    const { repo, table } = makeRepository({
      selectExisting: { data: [], error: null },
      insert: { data: [], error: null },
    });

    await repo.createSceneletShots('story-123', 'scenelet-9', 4, [
      {
        shotIndex: 1,
        storyboardPayload: { framing_and_angle: 'Wide shot' },
        firstFramePrompt: '  First frame prompt  ',
        keyFramePrompt: 'Key frame prompt',
        videoClipPrompt: 'Video clip prompt. No background music.',
      },
      {
        shotIndex: 2,
        storyboardPayload: { framing_and_angle: 'Close up' },
        firstFramePrompt: 'Another first frame',
        keyFramePrompt: 'Another key frame',
        videoClipPrompt: 'Another clip. No background music.',
      },
    ]);

    expect(table.selectCalls[0]).toMatchObject({
      columns: 'id',
      filters: [
        { type: 'eq', column: 'story_id', value: 'story-123' },
        { type: 'eq', column: 'scenelet_id', value: 'scenelet-9' },
      ],
    });

    expect(table.inserted).toHaveLength(1);
    const insertedRows = table.inserted[0];
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]).toMatchObject({
      story_id: 'story-123',
      scenelet_id: 'scenelet-9',
      scenelet_sequence: 4,
      shot_index: 1,
      storyboard_payload: { framing_and_angle: 'Wide shot' },
      first_frame_prompt: 'First frame prompt',
    });
    expect(insertedRows[0]).not.toHaveProperty('id');
  });

  it('throws when shots already exist for the scenelet', async () => {
    const { repo } = makeRepository({
      selectExisting: { data: [{ id: 'existing-shot' }], error: null },
    });

    await expect(
      repo.createSceneletShots('story-123', 'scenelet-1', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {},
          firstFramePrompt: 'First',
          keyFramePrompt: 'Key',
          videoClipPrompt: 'Clip. No background music.',
        },
      ])
    ).rejects.toBeInstanceOf(SceneletShotsAlreadyExistError);
  });

  it('throws when Supabase returns an error checking for existing shots', async () => {
    const { repo } = makeRepository({
      selectExisting: { data: null, error: { message: 'network error' } },
    });

    await expect(
      repo.createSceneletShots('story-123', 'scenelet-1', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {},
          firstFramePrompt: 'First',
          keyFramePrompt: 'Key',
          videoClipPrompt: 'Clip. No background music.',
        },
      ])
    ).rejects.toBeInstanceOf(ShotsRepositoryError);
  });

  it('throws when Supabase fails to insert rows', async () => {
    const { repo } = makeRepository({
      selectExisting: { data: [], error: null },
      insert: { data: null, error: { message: 'constraint violation' } },
    });

    await expect(
      repo.createSceneletShots('story-123', 'scenelet-1', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {},
          firstFramePrompt: 'First',
          keyFramePrompt: 'Key',
          videoClipPrompt: 'Clip. No background music.',
        },
      ])
    ).rejects.toBeInstanceOf(ShotsRepositoryError);
  });

  it('validates inputs before inserting rows', async () => {
    const { repo } = makeRepository({});

    await expect(
      repo.createSceneletShots('story-123', 'scenelet-1', 1, [])
    ).rejects.toThrow(/at least one shot/i);
    await expect(
      repo.createSceneletShots('', 'scenelet-1', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {},
          firstFramePrompt: 'First',
          keyFramePrompt: 'Key',
          videoClipPrompt: 'Clip. No background music.',
        },
      ])
    ).rejects.toBeInstanceOf(ShotsRepositoryError);
    await expect(
      repo.createSceneletShots('story-123', ' ', 1, [
        {
          shotIndex: 1,
          storyboardPayload: {},
          firstFramePrompt: 'First',
          keyFramePrompt: 'Key',
          videoClipPrompt: 'Clip. No background music.',
        },
      ])
    ).rejects.toBeInstanceOf(ShotsRepositoryError);
    await expect(
      repo.createSceneletShots('story-123', 'scenelet-1', 0, [
        {
          shotIndex: 1,
          storyboardPayload: {},
          firstFramePrompt: 'First',
          keyFramePrompt: 'Key',
          videoClipPrompt: 'Clip. No background music.',
        },
      ])
    ).rejects.toBeInstanceOf(ShotsRepositoryError);
  });
});

describe('shotsRepository.findSceneletIdsMissingShots', () => {
  it('returns scenelet ids with no stored shots', async () => {
    const { repo, table } = makeRepository({
      selectSceneletIds: {
        data: [{ scenelet_id: 'scenelet-1' }, { scenelet_id: 'scenelet-3' }],
        error: null,
      },
    });

    const result = await repo.findSceneletIdsMissingShots('story-123', [
      'scenelet-1',
      'scenelet-2',
      'scenelet-3',
    ]);

    expect(table.selectCalls[0]).toMatchObject({
      columns: 'scenelet_id',
      filters: [
        { type: 'eq', column: 'story_id', value: 'story-123' },
        { type: 'in', column: 'scenelet_id', values: ['scenelet-1', 'scenelet-2', 'scenelet-3'] },
      ],
    });

    expect(result).toEqual(['scenelet-2']);
  });

  it('treats all scenelets as missing when none persisted', async () => {
    const { repo } = makeRepository({
      selectSceneletIds: { data: [], error: null },
    });

    const result = await repo.findSceneletIdsMissingShots('story-123', ['scenelet-1']);
    expect(result).toEqual(['scenelet-1']);
  });

  it('returns an empty list when provided an empty scenelet list', async () => {
    const { repo } = makeRepository({});

    const result = await repo.findSceneletIdsMissingShots('story-123', []);
    expect(result).toEqual([]);
  });

  it('throws when Supabase returns an error', async () => {
    const { repo } = makeRepository({
      selectSceneletIds: { data: null, error: { message: 'permission denied' } },
    });

    await expect(
      repo.findSceneletIdsMissingShots('story-123', ['scenelet-1'])
    ).rejects.toBeInstanceOf(ShotsRepositoryError);
  });
});
