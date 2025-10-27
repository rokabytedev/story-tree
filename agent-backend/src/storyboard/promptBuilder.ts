import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { StoryboardTaskError } from './errors.js';

const YAML_PRIMER =
  'Each scenelet appears in depth-first order with sequential ids. Branching points list choices referencing the subsequent scenelet ids.';

export interface StoryboardPromptBuilderOptions {
  constitutionMarkdown: string;
  storyTree: StoryTreeSnapshot;
  visualDesignDocument: unknown;
}

export function buildStoryboardUserPrompt(options: StoryboardPromptBuilderOptions): string {
  const constitution = (options.constitutionMarkdown ?? '').trim();
  if (!constitution) {
    throw new StoryboardTaskError('Storyboard prompt requires constitution markdown.');
  }

  const yaml = (options.storyTree?.yaml ?? '').trim();
  if (!yaml) {
    throw new StoryboardTaskError('Storyboard prompt requires story tree YAML content.');
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
  ].join('\n');
}

function formatVisualDesignDocument(document: unknown): string {
  if (document === null || document === undefined) {
    throw new StoryboardTaskError('Visual design document is required for storyboard prompt.');
  }

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new StoryboardTaskError('Visual design document string must not be empty.');
    }
    return trimmed;
  }

  if (typeof document === 'object') {
    try {
      return JSON.stringify(document, null, 2);
    } catch (error) {
      throw new StoryboardTaskError('Failed to serialize visual design document for storyboard prompt.');
    }
  }

  throw new StoryboardTaskError('Visual design document must be a string or object.');
}
