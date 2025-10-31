import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

const SHOTS_TABLE = 'shots';

type ShotRow = {
  id: string;
  story_id: string;
  scenelet_id: string;
  scenelet_sequence: number;
  shot_index: number;
  storyboard_payload: unknown;
  key_frame_image_path: string | null;
  audio_file_path: string | null;
  created_at: string;
  updated_at: string;
};

export interface ShotRecord {
  sceneletSequence: number;
  shotIndex: number;
  storyboardPayload: unknown;
  keyFrameImagePath?: string;
  audioFilePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShotInput {
  shotIndex: number;
  storyboardPayload: unknown;
  audioFilePath?: string | null;
}

export interface UpdateShotImagePathsInput {
  keyFrameImagePath?: string | null;
}

export interface ShotsMissingImages {
  sceneletId: string;
  shotIndex: number;
  missingKeyFrame: boolean;
}

export interface ShotsRepository {
  getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>>;
  createSceneletShots(
    storyId: string,
    sceneletId: string,
    sceneletSequence: number,
    shots: CreateShotInput[]
  ): Promise<void>;
  findSceneletIdsMissingShots(storyId: string, sceneletIds: string[]): Promise<string[]>;
  updateShotImagePaths(
    storyId: string,
    sceneletId: string,
    shotIndex: number,
    paths: UpdateShotImagePathsInput
  ): Promise<void>;
  updateShotAudioPath(
    storyId: string,
    sceneletId: string,
    shotIndex: number,
    audioFilePath: string | null
  ): Promise<ShotRecord>;
  findShotsMissingImages(storyId: string): Promise<ShotsMissingImages[]>;
}

export class ShotsRepositoryError extends Error {
  public readonly causeError?: PostgrestError | null;

  constructor(message: string, cause?: PostgrestError | null) {
    super(message);
    this.name = 'ShotsRepositoryError';
    this.causeError = cause ?? undefined;
  }
}

export class SceneletShotsAlreadyExistError extends ShotsRepositoryError {
  constructor(message = 'Shots already exist for scenelet.') {
    super(message, null);
    this.name = 'SceneletShotsAlreadyExistError';
  }
}

export function createShotsRepository(client: SupabaseClient): ShotsRepository {
  if (!client) {
    throw new ShotsRepositoryError('Supabase client instance is required.');
  }

  return {
    async getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new ShotsRepositoryError('Story id must be provided to fetch shots.');
      }

      const { data, error } = await client
        .from(SHOTS_TABLE)
        .select()
        .eq('story_id', trimmedStoryId)
        .order('scenelet_sequence', { ascending: true })
        .order('shot_index', { ascending: true });

      if (error) {
        throw new ShotsRepositoryError('Failed to load shots for story.', error);
      }

      if (!Array.isArray(data) || data.length === 0) {
        return {};
      }

      const sorted = [...data].sort((a, b) => {
        if (a.scenelet_sequence !== b.scenelet_sequence) {
          return a.scenelet_sequence - b.scenelet_sequence;
        }

        if (a.scenelet_id !== b.scenelet_id) {
          return a.scenelet_id.localeCompare(b.scenelet_id);
        }

        if (a.shot_index !== b.shot_index) {
          return a.shot_index - b.shot_index;
        }

        return 0;
      });

      return sorted.reduce<Record<string, ShotRecord[]>>((acc, row) => {
        const grouped = acc[row.scenelet_id] ?? [];
        grouped.push(mapRowToRecord(row));
        acc[row.scenelet_id] = grouped;
        return acc;
      }, {});
    },

    async createSceneletShots(
      storyId: string,
      sceneletId: string,
      sceneletSequence: number,
      shots: CreateShotInput[]
    ): Promise<void> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new ShotsRepositoryError('Story id must be provided to persist shots.');
      }

      const trimmedSceneletId = sceneletId?.trim();
      if (!trimmedSceneletId) {
        throw new ShotsRepositoryError('Scenelet id must be provided to persist shots.');
      }

      if (!Number.isInteger(sceneletSequence) || sceneletSequence <= 0) {
        throw new ShotsRepositoryError('Scenelet sequence must be a positive integer.');
      }

      if (!Array.isArray(shots) || shots.length === 0) {
        throw new ShotsRepositoryError('At least one shot must be provided for persistence.');
      }

      const { data: existing, error: checkError } = await client
        .from(SHOTS_TABLE)
        .select('id')
        .eq('story_id', trimmedStoryId)
        .eq('scenelet_id', trimmedSceneletId)
        .limit(1);

      if (checkError) {
        throw new ShotsRepositoryError('Failed to verify existing scenelet shots.', checkError);
      }

      if (Array.isArray(existing) && existing.length > 0) {
        throw new SceneletShotsAlreadyExistError(
          `Shots already exist for story ${trimmedStoryId} scenelet ${trimmedSceneletId}.`
        );
      }

      const rows = shots.map((shot, index) => {
        if (!Number.isInteger(shot?.shotIndex) || shot.shotIndex <= 0) {
          throw new ShotsRepositoryError('Shot index must be a positive integer.');
        }

        if (shot.storyboardPayload === undefined || shot.storyboardPayload === null) {
          throw new ShotsRepositoryError(`Shot ${index + 1} storyboard payload must be provided.`);
        }

        return {
          story_id: trimmedStoryId,
          scenelet_id: trimmedSceneletId,
          scenelet_sequence: sceneletSequence,
          shot_index: shot.shotIndex,
          storyboard_payload: shot.storyboardPayload,
          audio_file_path: shot.audioFilePath ?? null,
        };
      });

      const { error: insertError } = await client.from(SHOTS_TABLE).insert(rows);

      if (insertError) {
        throw new ShotsRepositoryError('Failed to persist scenelet shots.', insertError);
      }
    },

    async findSceneletIdsMissingShots(
      storyId: string,
      sceneletIds: string[]
    ): Promise<string[]> {
      if (!Array.isArray(sceneletIds) || sceneletIds.length === 0) {
        return [];
      }

      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new ShotsRepositoryError('Story id must be provided to locate missing shots.');
      }

      const normalizedSceneletIds = sceneletIds
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id));

      if (normalizedSceneletIds.length === 0) {
        return [];
      }

      const { data, error } = await client
        .from(SHOTS_TABLE)
        .select('scenelet_id')
        .eq('story_id', trimmedStoryId)
        .in('scenelet_id', normalizedSceneletIds);

      if (error) {
        throw new ShotsRepositoryError('Failed to determine scenelet shot coverage.', error);
      }

      const existing = new Set((data ?? []).map((row) => row.scenelet_id));
      return normalizedSceneletIds.filter((id) => !existing.has(id));
    },

    async updateShotImagePaths(
      storyId: string,
      sceneletId: string,
      shotIndex: number,
      paths: UpdateShotImagePathsInput
    ): Promise<void> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new ShotsRepositoryError('Story id must be provided to update shot image paths.');
      }

      const trimmedSceneletId = sceneletId?.trim();
      if (!trimmedSceneletId) {
        throw new ShotsRepositoryError('Scenelet id must be provided to update shot image paths.');
      }

      if (!Number.isInteger(shotIndex) || shotIndex <= 0) {
        throw new ShotsRepositoryError('Shot index must be a positive integer.');
      }

      if (!paths || paths.keyFrameImagePath === undefined) {
        throw new ShotsRepositoryError('Key frame image path must be provided for update.');
      }

      const updateData: Record<string, string | null> = {};
      updateData.key_frame_image_path = paths.keyFrameImagePath || null;

      const { error } = await client
        .from(SHOTS_TABLE)
        .update(updateData)
        .eq('story_id', trimmedStoryId)
        .eq('scenelet_id', trimmedSceneletId)
        .eq('shot_index', shotIndex);

      if (error) {
        throw new ShotsRepositoryError('Failed to update shot image paths.', error);
      }
    },

    async updateShotAudioPath(
      storyId: string,
      sceneletId: string,
      shotIndex: number,
      audioFilePath: string | null
    ): Promise<ShotRecord> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new ShotsRepositoryError('Story id must be provided to update shot audio path.');
      }

      const trimmedSceneletId = sceneletId?.trim();
      if (!trimmedSceneletId) {
        throw new ShotsRepositoryError('Scenelet id must be provided to update shot audio path.');
      }

      if (!Number.isInteger(shotIndex) || shotIndex <= 0) {
        throw new ShotsRepositoryError('Shot index must be a positive integer.');
      }

      const { error } = await client
        .from(SHOTS_TABLE)
        .update({ audio_file_path: audioFilePath ?? null })
        .eq('story_id', trimmedStoryId)
        .eq('scenelet_id', trimmedSceneletId)
        .eq('shot_index', shotIndex);

      if (error) {
        throw new ShotsRepositoryError('Failed to update shot audio path.', error);
      }

      const response = await client
        .from(SHOTS_TABLE)
        .select()
        .eq('story_id', trimmedStoryId)
        .eq('scenelet_id', trimmedSceneletId)
        .eq('shot_index', shotIndex)
        .limit(1);

      if (response.error) {
        throw new ShotsRepositoryError('Failed to load updated shot.', response.error);
      }

      const rows = Array.isArray(response.data) ? response.data : [];
      if (rows.length === 0) {
        throw new ShotsRepositoryError('Shot not found after audio path update.', null);
      }

      return mapRowToRecord(rows[0] as ShotRow);
    },

    async findShotsMissingImages(storyId: string): Promise<ShotsMissingImages[]> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new ShotsRepositoryError('Story id must be provided to find shots missing images.');
      }

      const { data, error } = await client
        .from(SHOTS_TABLE)
        .select('scenelet_id, shot_index, key_frame_image_path')
        .eq('story_id', trimmedStoryId)
        .order('scenelet_sequence', { ascending: true })
        .order('shot_index', { ascending: true });

      if (error) {
        throw new ShotsRepositoryError('Failed to find shots missing images.', error);
      }

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      return data
        .filter((row) => !row.key_frame_image_path)
        .map((row) => ({
          sceneletId: row.scenelet_id,
          shotIndex: row.shot_index,
          missingKeyFrame: !row.key_frame_image_path,
        }));
    },
  };
}

function mapRowToRecord(row: ShotRow): ShotRecord {
  return {
    sceneletSequence: row.scenelet_sequence,
    shotIndex: row.shot_index,
    storyboardPayload: row.storyboard_payload,
    keyFrameImagePath: row.key_frame_image_path ?? undefined,
    audioFilePath: row.audio_file_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
