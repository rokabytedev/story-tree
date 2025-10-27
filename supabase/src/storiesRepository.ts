import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

const STORIES_TABLE = 'stories';

type StoryRow = {
  id: string;
  display_name: string;
  display_name_upper: string | null;
  initial_prompt: string;
  created_at: string;
  updated_at: string;
  story_constitution: unknown | null;
  visual_design_document: unknown | null;
  audio_design_document: unknown | null;
  visual_reference_package: unknown | null;
};

export interface StoryRecord {
  id: string;
  displayName: string;
  displayNameUpper: string | null;
  initialPrompt: string;
  createdAt: string;
  updatedAt: string;
  storyConstitution: unknown | null;
  visualDesignDocument: unknown | null;
  audioDesignDocument: unknown | null;
  visualReferencePackage: unknown | null;
}

export interface CreateStoryInput {
  displayName: string;
  initialPrompt: string;
  storyConstitution?: unknown;
  visualDesignDocument?: unknown;
  audioDesignDocument?: unknown;
  visualReferencePackage?: unknown;
}

export interface StoryArtifactPatch {
  displayName?: string;
  storyConstitution?: unknown;
  visualDesignDocument?: unknown;
  audioDesignDocument?: unknown;
  visualReferencePackage?: unknown;
}

export interface StoriesRepository {
  createStory(input: CreateStoryInput): Promise<StoryRecord>;
  updateStoryArtifacts(storyId: string, patch: StoryArtifactPatch): Promise<StoryRecord>;
  getStoryById(storyId: string): Promise<StoryRecord | null>;
  listStories(): Promise<StoryRecord[]>;
  deleteStoryById(storyId: string): Promise<void>;
}

export class StoriesRepositoryError extends Error {
  public readonly causeError?: PostgrestError | null;

  constructor(message: string, cause?: PostgrestError | null) {
    super(message);
    this.name = 'StoriesRepositoryError';
    this.causeError = cause ?? undefined;
  }
}

export class StoryNotFoundError extends StoriesRepositoryError {
  constructor(message = 'Story not found.') {
    super(message, null);
    this.name = 'StoryNotFoundError';
  }
}

export function createStoriesRepository(client: SupabaseClient): StoriesRepository {
  if (!client) {
    throw new StoriesRepositoryError('Supabase client instance is required.');
  }

  return {
    async listStories(): Promise<StoryRecord[]> {
      const { data, error } = await client.from<StoryRow>(STORIES_TABLE).select();

      if (error) {
        throw new StoriesRepositoryError('Failed to list stories.', error);
      }

      if (!data) {
        return [];
      }

      return data.map(mapRowToRecord);
    },

    async createStory(input: CreateStoryInput): Promise<StoryRecord> {
      const baseName = input.displayName?.trim();
      if (!baseName) {
        throw new StoriesRepositoryError('Story display name must be provided.');
      }

      const prompt = input.initialPrompt?.trim();
      if (!prompt) {
        throw new StoriesRepositoryError('Story initial prompt must be provided.');
      }

      const payload = buildInsertPayload(input);
      const { data, error } = await client
        .from<StoryRow>(STORIES_TABLE)
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        throw new StoriesRepositoryError('Failed to create story.', error ?? null);
      }

      return mapRowToRecord(data);
    },

    async updateStoryArtifacts(storyId: string, patch: StoryArtifactPatch): Promise<StoryRecord> {
      const trimmedId = storyId?.trim();
      if (!trimmedId) {
        throw new StoriesRepositoryError('Story id must be provided for updates.');
      }

      const payload = buildUpdatePayload(patch);
      if (Object.keys(payload).length === 0) {
        throw new StoriesRepositoryError('At least one artifact field must be provided to update.');
      }

      const { data, error } = await client
        .from<StoryRow>(STORIES_TABLE)
        .update(payload)
        .eq('id', trimmedId)
        .select()
        .maybeSingle();

      if (error) {
        throw new StoriesRepositoryError('Failed to update story artifacts.', error);
      }

      if (!data) {
        throw new StoryNotFoundError(`Story ${trimmedId} does not exist.`);
      }

      return mapRowToRecord(data);
    },

    async getStoryById(storyId: string): Promise<StoryRecord | null> {
      const trimmedId = storyId?.trim();
      if (!trimmedId) {
        throw new StoriesRepositoryError('Story id must be provided for lookup.');
      }

      const { data, error } = await client
        .from<StoryRow>(STORIES_TABLE)
        .select()
        .eq('id', trimmedId)
        .maybeSingle();

      if (error) {
        throw new StoriesRepositoryError('Failed to load story.', error);
      }

      if (!data) {
        return null;
      }

      return mapRowToRecord(data);
    },

    async deleteStoryById(storyId: string): Promise<void> {
      const trimmedId = storyId?.trim();
      if (!trimmedId) {
        throw new StoriesRepositoryError('Story id must be provided for deletion.');
      }

      const { data, error } = await client
        .from<StoryRow>(STORIES_TABLE)
        .delete()
        .eq('id', trimmedId)
        .select()
        .maybeSingle();

      if (error) {
        throw new StoriesRepositoryError('Failed to delete story.', error);
      }

      if (!data) {
        throw new StoryNotFoundError(`Story ${trimmedId} does not exist.`);
      }
    },
  } satisfies StoriesRepository;
}

function buildInsertPayload(input: CreateStoryInput): Partial<StoryRow> {
  const payload: Partial<StoryRow> = {
    display_name: input.displayName.trim(),
    initial_prompt: input.initialPrompt.trim(),
  };

  if (input.storyConstitution !== undefined) {
    payload.story_constitution = input.storyConstitution;
  }
  if (input.visualDesignDocument !== undefined) {
    payload.visual_design_document = input.visualDesignDocument;
  }
  if (input.audioDesignDocument !== undefined) {
    payload.audio_design_document = input.audioDesignDocument;
  }
  if (input.visualReferencePackage !== undefined) {
    payload.visual_reference_package = input.visualReferencePackage;
  }

  return payload;
}

function buildUpdatePayload(patch: StoryArtifactPatch): Partial<StoryRow> {
  const payload: Partial<StoryRow> = {};

  if (patch.displayName !== undefined) {
    const trimmed = patch.displayName.trim();
    if (!trimmed) {
      throw new StoriesRepositoryError('Story display name must not be empty when provided.');
    }
    payload.display_name = trimmed;
  }
  if (patch.storyConstitution !== undefined) {
    payload.story_constitution = patch.storyConstitution;
  }
  if (patch.visualDesignDocument !== undefined) {
    payload.visual_design_document = patch.visualDesignDocument;
  }
  if (patch.audioDesignDocument !== undefined) {
    payload.audio_design_document = patch.audioDesignDocument;
  }
  if (patch.visualReferencePackage !== undefined) {
    payload.visual_reference_package = patch.visualReferencePackage;
  }

  return payload;
}

function mapRowToRecord(row: StoryRow): StoryRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    displayNameUpper: row.display_name_upper,
    initialPrompt: row.initial_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storyConstitution: row.story_constitution,
    visualDesignDocument: row.visual_design_document,
    audioDesignDocument: row.audio_design_document,
    visualReferencePackage: row.visual_reference_package,
  };
}
