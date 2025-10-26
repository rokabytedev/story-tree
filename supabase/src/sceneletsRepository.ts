import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

const SCENELETS_TABLE = 'scenelets';

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

export interface SceneletRecord {
  id: string;
  storyId: string;
  parentId: string | null;
  choiceLabelFromParent: string | null;
  choicePrompt: string | null;
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
        .from<SceneletRow>(SCENELETS_TABLE)
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
        .from<SceneletRow>(SCENELETS_TABLE)
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
        .from<SceneletRow>(SCENELETS_TABLE)
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
  } satisfies SceneletsRepository;
}

function mapRowToRecord(row: SceneletRow): SceneletRecord {
  return {
    id: row.id,
    storyId: row.story_id,
    parentId: row.parent_id,
    choiceLabelFromParent: row.choice_label_from_parent,
    choicePrompt: row.choice_prompt,
    content: row.content,
    isBranchPoint: row.is_branch_point,
    isTerminalNode: row.is_terminal_node,
    createdAt: row.created_at,
  };
}
