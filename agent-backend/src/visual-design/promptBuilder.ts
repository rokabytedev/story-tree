import type { StoryTreeSnapshot } from '../story-storage/types.js';
import { VisualDesignTaskError } from './errors.js';

const YAML_PRIMER =
  'Each scenelet appears in depth-first order with sequential ids. Branching points list choices referencing the subsequent scenelet ids.';

export interface VisualDesignPromptOptions {
  constitutionMarkdown: string;
  storyTree: StoryTreeSnapshot;
}

export function buildVisualDesignUserPrompt(options: VisualDesignPromptOptions): string {
  const constitution = (options.constitutionMarkdown ?? '').trim();
  if (!constitution) {
    throw new VisualDesignTaskError('Visual design prompt requires constitution markdown.');
  }

  const yaml = (options.storyTree.yaml ?? '').trim();
  if (!yaml) {
    throw new VisualDesignTaskError('Visual design prompt requires story tree YAML content.');
  }

  return [
    'Story Constitution (Markdown)',
    constitution,
    '',
    'Interactive Script Story Tree (YAML)',
    YAML_PRIMER,
    yaml,
  ].join('\n');
}
