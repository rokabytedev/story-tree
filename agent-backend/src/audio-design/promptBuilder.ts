import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { AudioDesignTaskError } from './errors.js';

const YAML_PRIMER =
  'Each scenelet appears in depth-first order with sequential ids. Branching points list choices referencing the subsequent scenelet ids.';

const TASK_INSTRUCTIONS = [
  'Output MUST be a single JSON object named audio_design_document.',
  'Match character_name values exactly (case-sensitive) to the visual design characters.',
  'Match associated_scenelet_ids to the scenelet ids in the YAML exactly.',
  'Ensure every field described in the system prompt is populated with detailed, non-empty content.',
].join(' ');

export interface AudioDesignPromptBuilderOptions {
  constitutionMarkdown: string;
  storyTree: StoryTreeSnapshot;
  visualDesignDocument: unknown;
}

export function buildAudioDesignUserPrompt(options: AudioDesignPromptBuilderOptions): string {
  const constitution = (options.constitutionMarkdown ?? '').trim();
  if (!constitution) {
    throw new AudioDesignTaskError('Audio design prompt requires constitution markdown.');
  }

  const yaml = (options.storyTree?.yaml ?? '').trim();
  if (!yaml) {
    throw new AudioDesignTaskError('Audio design prompt requires story tree YAML content.');
  }

  const visualDesignSection = formatVisualDesignDocument(options.visualDesignDocument);

  return [
    '# Story Constitution',
    constitution,
    '',
    '# Interactive Script Story Tree (YAML)',
    YAML_PRIMER,
    yaml,
    '',
    '# Visual Design Document',
    visualDesignSection,
    '',
    '# Task Instructions',
    TASK_INSTRUCTIONS,
  ].join('\n');
}

function formatVisualDesignDocument(document: unknown): string {
  if (document === null || document === undefined) {
    throw new AudioDesignTaskError('Visual design document is required for audio design prompt.');
  }

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new AudioDesignTaskError('Visual design document string must not be empty.');
    }
    return trimmed;
  }

  if (typeof document === 'object') {
    try {
      return JSON.stringify(document, null, 2);
    } catch (error) {
      throw new AudioDesignTaskError('Failed to serialize visual design document for audio design prompt.');
    }
  }

  throw new AudioDesignTaskError('Visual design document must be a string or object.');
}
