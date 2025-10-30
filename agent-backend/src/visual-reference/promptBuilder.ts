import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { VisualReferenceTaskError } from './errors.js';

const YAML_PRIMER =
  'Each scenelet appears in depth-first order with sequential ids. Branching points list choices referencing the subsequent scenelet ids.';

const TASK_INSTRUCTIONS = [
  'Produce a single JSON object named visual_reference_package that matches the schema described in the system prompt.',
  'The visual design document contains character_id and environment_id fields (normalized slug-style identifiers). Use these exact IDs in your response for character_id and environment_id fields in the visual_reference_package.',
  'Provide at least one reference plate with type "CHARACTER_MODEL_SHEET" for every character and include optional contextual action shots.',
  'Every image_generation_prompt must be richly descriptive (>= 80 characters) and clearly reference the character or environment by a recognizable name or description.',
  'Environment keyframes must describe lighting or atmospheric context so downstream renders stay consistent.',
].join(' ');

export interface VisualReferencePromptBuilderOptions {
  constitutionMarkdown: string;
  storyTree: StoryTreeSnapshot;
  visualDesignDocument: unknown;
}

export function buildVisualReferenceUserPrompt(options: VisualReferencePromptBuilderOptions): string {
  const constitution = (options.constitutionMarkdown ?? '').trim();
  if (!constitution) {
    throw new VisualReferenceTaskError('Visual reference prompt requires constitution markdown.');
  }

  const yaml = (options.storyTree?.yaml ?? '').trim();
  if (!yaml) {
    throw new VisualReferenceTaskError('Visual reference prompt requires story tree YAML content.');
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
    throw new VisualReferenceTaskError('Visual design document is required for visual reference prompt.');
  }

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new VisualReferenceTaskError('Visual design document string must not be empty.');
    }
    return trimmed;
  }

  if (typeof document === 'object') {
    try {
      return JSON.stringify(document, null, 2);
    } catch (error) {
      throw new VisualReferenceTaskError('Failed to serialize visual design document for visual reference prompt.');
    }
  }

  throw new VisualReferenceTaskError('Visual design document must be a string or object.');
}
