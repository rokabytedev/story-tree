import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

const SCENELETS_TABLE = 'scenelets';

type SceneletRow = {
  id: string;
  story_id: string;
  parent_id: string | null;
  choice_label_from_parent: string | null;
  choice_prompt: string | null;
  branch_audio_file_path: string | null;
  content: unknown;
  is_branch_point: boolean;
  is_terminal_node: boolean;
  created_at: string;
};

export interface SceneletRecord {
  id: string;
  storyId: string;
  parentId: string | null;
  choiceLabelFromParent: string | null;
  choicePrompt: string | null;
  branchAudioFilePath?: string;
  content: unknown;
  isBranchPoint: boolean;
  isTerminalNode: boolean;
  createdAt: string;
}

export interface CreateSceneletInput {
  storyId: string;
  parentId: string | null;
  choiceLabelFromParent?: string | null;
  content: unknown;
}

export interface SceneletsRepository {
  createScenelet(input: CreateSceneletInput): Promise<SceneletRecord>;
  markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<SceneletRecord>;
  markSceneletAsTerminal(sceneletId: string): Promise<SceneletRecord>;
  updateBranchAudioPath(
    storyId: string,
    sceneletId: string,
    branchAudioFilePath: string | null
  ): Promise<SceneletRecord>;
  hasSceneletsForStory(storyId: string): Promise<boolean>;
  listSceneletsByStory(storyId: string): Promise<SceneletRecord[]>;
}

export class SceneletsRepositoryError extends Error {
  public readonly causeError?: PostgrestError | null;

  constructor(message: string, cause?: PostgrestError | null) {
    super(message);
    this.name = 'SceneletsRepositoryError';
    this.causeError = cause ?? undefined;
  }
}

export class SceneletNotFoundError extends SceneletsRepositoryError {
  constructor(message = 'Scenelet not found.') {
    super(message, null);
    this.name = 'SceneletNotFoundError';
  }
}

export function createSceneletsRepository(client: SupabaseClient): SceneletsRepository {
  if (!client) {
    throw new SceneletsRepositoryError('Supabase client instance is required.');
  }

  return {
    async createScenelet(input: CreateSceneletInput): Promise<SceneletRecord> {
      const trimmedStoryId = input.storyId?.trim();
      if (!trimmedStoryId) {
        throw new SceneletsRepositoryError('Scenelet story id must be provided.');
      }

      if (input.content === undefined) {
        throw new SceneletsRepositoryError('Scenelet content must be provided.');
      }

      const payload: Partial<SceneletRow> = {
        story_id: trimmedStoryId,
        parent_id: input.parentId ?? null,
        content: input.content,
        choice_label_from_parent: input.choiceLabelFromParent ?? null,
      };

      const { data, error } = await client
        .from(SCENELETS_TABLE)
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        throw new SceneletsRepositoryError('Failed to create scenelet.', error ?? null);
      }

      return mapRowToRecord(data);
    },

    async markSceneletAsBranchPoint(sceneletId: string, choicePrompt: string): Promise<SceneletRecord> {
      const trimmedId = sceneletId?.trim();
      if (!trimmedId) {
        throw new SceneletsRepositoryError('Scenelet id must be provided for updates.');
      }

      const prompt = choicePrompt?.trim();
      if (!prompt) {
        throw new SceneletsRepositoryError('Branch choice prompt must be provided.');
      }

      const { data, error } = await client
        .from(SCENELETS_TABLE)
        .update({
          is_branch_point: true,
          choice_prompt: prompt,
        })
        .eq('id', trimmedId)
        .select()
        .maybeSingle();

      if (error) {
        throw new SceneletsRepositoryError('Failed to mark scenelet as branch point.', error);
      }

      if (!data) {
        throw new SceneletNotFoundError(`Scenelet ${trimmedId} does not exist.`);
      }

      return mapRowToRecord(data);
    },

    async markSceneletAsTerminal(sceneletId: string): Promise<SceneletRecord> {
      const trimmedId = sceneletId?.trim();
      if (!trimmedId) {
        throw new SceneletsRepositoryError('Scenelet id must be provided for updates.');
      }

      const { data, error } = await client
        .from(SCENELETS_TABLE)
        .update({
          is_terminal_node: true,
        })
        .eq('id', trimmedId)
        .select()
        .maybeSingle();

      if (error) {
        throw new SceneletsRepositoryError('Failed to mark scenelet as terminal.', error);
      }

      if (!data) {
        throw new SceneletNotFoundError(`Scenelet ${trimmedId} does not exist.`);
      }

      return mapRowToRecord(data);
    },

    async updateBranchAudioPath(
      storyId: string,
      sceneletId: string,
      branchAudioFilePath: string | null
    ): Promise<SceneletRecord> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new SceneletsRepositoryError(
          'Story id must be provided to update branch audio path.'
        );
      }

      const trimmedSceneletId = sceneletId?.trim();
      if (!trimmedSceneletId) {
        throw new SceneletsRepositoryError(
          'Scenelet id must be provided to update branch audio path.'
        );
      }

      let normalizedPath: string | null = null;
      if (branchAudioFilePath !== null && branchAudioFilePath !== undefined) {
        const trimmedPath = branchAudioFilePath.trim();
        if (trimmedPath) {
          normalizedPath = trimmedPath;
        }
      }

      const { data, error } = await client
        .from(SCENELETS_TABLE)
        .update({
          branch_audio_file_path: normalizedPath,
        })
        .eq('story_id', trimmedStoryId)
        .eq('id', trimmedSceneletId)
        .select()
        .maybeSingle();

      if (error) {
        throw new SceneletsRepositoryError('Failed to update branch audio path.', error);
      }

      if (!data) {
        throw new SceneletNotFoundError(
          `Scenelet ${trimmedSceneletId} does not exist for story ${trimmedStoryId}.`
        );
      }

      return mapRowToRecord(data);
    },

    async hasSceneletsForStory(storyId: string): Promise<boolean> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new SceneletsRepositoryError('Story id must be provided to check scenelets.');
      }

      const { data, error } = await client
        .from(SCENELETS_TABLE)
        .select('id')
        .eq('story_id', trimmedStoryId)
        .limit(1);

      if (error) {
        throw new SceneletsRepositoryError('Failed to check scenelet existence.', error);
      }

      return Array.isArray(data) && data.length > 0;
    },

    async listSceneletsByStory(storyId: string): Promise<SceneletRecord[]> {
      const trimmedStoryId = storyId?.trim();
      if (!trimmedStoryId) {
        throw new SceneletsRepositoryError('Story id must be provided to list scenelets.');
      }

      const { data, error } = await client
        .from(SCENELETS_TABLE)
        .select()
        .eq('story_id', trimmedStoryId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new SceneletsRepositoryError('Failed to list scenelets for story.', error);
      }

      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }

      return data.map(mapRowToRecord);
    },
  } satisfies SceneletsRepository;
}

function mapRowToRecord(row: SceneletRow): SceneletRecord {
  const branchAudioFilePath =
    typeof row.branch_audio_file_path === 'string' ? row.branch_audio_file_path.trim() : '';

  return {
    id: row.id,
    storyId: row.story_id,
    parentId: row.parent_id,
    choiceLabelFromParent: row.choice_label_from_parent,
    choicePrompt: row.choice_prompt,
    branchAudioFilePath: branchAudioFilePath ? branchAudioFilePath : undefined,
    content: row.content,
    isBranchPoint: row.is_branch_point,
    isTerminalNode: row.is_terminal_node,
    createdAt: row.created_at,
  };
}
