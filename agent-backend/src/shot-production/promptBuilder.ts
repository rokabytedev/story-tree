import type { BranchingPointDigest, SceneletDigest, StoryTreeEntry } from '../story-storage/types.js';
import { ShotProductionTaskError } from './errors.js';
import type { ShotProductionPromptBuilderOptions } from './types.js';

const YAML_PRIMER =
  'Each scenelet appears in depth-first order with sequential ids. Branching points list choices referencing the subsequent scenelet ids.';

const TASK_DIRECTIVES = [
  '- Treat this request as stateless beyond the materials provided here. Do not reference prior scenelets or past prompts.',
  "- Evaluate the director's shot_suggestions critically before finalizing your own ordered sequence.",
  '- Return every shot for this scenelet in narrative order with shot_index starting at 1 and incrementing by 1 with no gaps.',
  '- Provide detailed prose in every storyboard_entry field, and ensure each generation prompt is at least 80 characters.',
  '- Include the exact phrase "No background music." in every video_clip_prompt.',
  '- Produce JSON only, matching the schema described in the system prompt: {"scenelet_id": string, "shots": [{ "shot_index": number, "storyboard_entry": {...}, "generation_prompts": {...} }]}',
];

export function buildShotProductionUserPrompt(options: ShotProductionPromptBuilderOptions): string {
  const constitution = (options.constitutionMarkdown ?? '').trim();
  if (!constitution) {
    throw new ShotProductionTaskError('Shot production prompt requires constitution markdown.');
  }

  const yaml = (options.storyTree?.yaml ?? '').trim();
  if (!yaml) {
    throw new ShotProductionTaskError('Shot production prompt requires story tree YAML content.');
  }

  if (!options.scenelet) {
    throw new ShotProductionTaskError('Shot production prompt requires a target scenelet.');
  }

  const visualDesignSection = formatDocument(options.visualDesignDocument, 'visual design document');
  const audioDesignSection = formatDocument(options.audioDesignDocument, 'audio design document');
  const sceneletSection = formatSceneletSection(options.scenelet, options.storyTree.entries);

  return [
    '# Story Constitution',
    constitution,
    '',
    '# Interactive Script Story Tree (YAML)',
    YAML_PRIMER,
    yaml,
    '',
    '# Visual Design Bible',
    visualDesignSection,
    '',
    '# Audio Design Bible',
    audioDesignSection,
    '',
    '# Target Scenelet',
    sceneletSection,
    '',
    '# Task Directives',
    TASK_DIRECTIVES.join('\n'),
  ].join('\n');
}

function formatDocument(document: unknown, label: string): string {
  if (document === null || document === undefined) {
    throw new ShotProductionTaskError(`A ${label} must be provided for shot production prompts.`);
  }

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new ShotProductionTaskError(`The ${label} string must not be empty.`);
    }
    return trimmed;
  }

  if (typeof document === 'object') {
    try {
      return JSON.stringify(document, null, 2);
    } catch (error) {
      throw new ShotProductionTaskError(`Failed to serialize the ${label} for shot production prompt.`);
    }
  }

  throw new ShotProductionTaskError(`The ${label} must be a string or object.`);
}

function formatSceneletSection(scenelet: SceneletDigest, entries: StoryTreeEntry[]): string {
  const sceneletMap = buildSceneletMap(entries);
  const sequence = resolveSceneletSequence(scenelet.id, entries);
  const pathLine = renderSceneletPath(scenelet, sceneletMap);
  const branchingSection = renderBranchingSection(scenelet, entries);
  const dialogueSection = renderDialogueSection(scenelet);
  const shotSuggestionsSection = renderShotSuggestionsSection(scenelet);

  return [
    '## Metadata',
    `- scenelet_id: ${scenelet.id}`,
    `- role: ${scenelet.role}`,
    `- scenelet_sequence: ${sequence}`,
    `- parent_scenelet_id: ${scenelet.parentId ?? 'none'}`,
    `- parent_choice_label: ${scenelet.choiceLabel ?? 'none'}`,
    `- description: ${scenelet.description?.trim() || 'No description provided.'}`,
    '',
    '## Branching Context',
    pathLine,
    branchingSection,
    '',
    '## Dialogue',
    dialogueSection,
    '',
    '## Shot Suggestions',
    shotSuggestionsSection,
  ].join('\n');
}

function buildSceneletMap(entries: StoryTreeEntry[]): Map<string, SceneletDigest> {
  const map = new Map<string, SceneletDigest>();

  for (const entry of entries) {
    if (entry.kind === 'scenelet' && entry.data && typeof entry.data === 'object') {
      const data = entry.data as SceneletDigest;
      map.set(data.id, data);
    }
  }

  return map;
}

function resolveSceneletSequence(sceneletId: string, entries: StoryTreeEntry[]): number {
  let sequence = 0;

  for (const entry of entries) {
    if (entry.kind !== 'scenelet') {
      continue;
    }

    sequence += 1;
    const data = entry.data as SceneletDigest;
    if (data.id === sceneletId) {
      return sequence;
    }
  }

  throw new ShotProductionTaskError(`Target scenelet ${sceneletId} was not found in the story tree.`);
}

function renderSceneletPath(scenelet: SceneletDigest, sceneletMap: Map<string, SceneletDigest>): string {
  const chain: SceneletDigest[] = [];
  let current: SceneletDigest | undefined = scenelet;

  while (current) {
    chain.push(current);
    if (!current.parentId) {
      break;
    }

    const parent = sceneletMap.get(current.parentId);
    if (!parent) {
      throw new ShotProductionTaskError(
        `Story tree is missing parent scenelet ${current.parentId} for ${current.id}.`
      );
    }
    current = parent;
  }

  const ordered = chain.reverse();
  const segments = ordered.map((node, index) => {
    const details: string[] = [`role: ${node.role}`];
    if (index > 0) {
      details.push(`choice_from_parent: ${node.choiceLabel ?? 'none'}`);
    }
    return `${node.id} (${details.join(', ')})`;
  });

  return segments.length > 0
    ? `- path_from_root: ${segments.join(' -> ')}`
    : '- path_from_root: unavailable';
}

function renderBranchingSection(scenelet: SceneletDigest, entries: StoryTreeEntry[]): string {
  const branch = entries.find(
    (entry): entry is { kind: 'branching-point'; data: BranchingPointDigest } =>
      entry.kind === 'branching-point' &&
      entry.data &&
      typeof entry.data === 'object' &&
      (entry.data as BranchingPointDigest).sourceSceneletId === scenelet.id
  );

  if (!branch) {
    return '- downstream_choices: none (terminal or linear scenelet)';
  }

  const digest = branch.data;
  const header = `- downstream_choice_prompt: ${digest.choicePrompt?.trim() || 'No prompt provided.'}`;

  if (!Array.isArray(digest.choices) || digest.choices.length === 0) {
    return [header, '- downstream_choices: none'].join('\n');
  }

  const choices = digest.choices
    .map(
      (choice, index) =>
        `  ${index + 1}. label: ${choice.label?.trim() || 'Unlabeled'} -> leads_to: ${choice.leadsTo}`
    )
    .join('\n');

  return [header, '- downstream_choices:', choices].join('\n');
}

function renderDialogueSection(scenelet: SceneletDigest): string {
  if (!Array.isArray(scenelet.dialogue) || scenelet.dialogue.length === 0) {
    return '- No dialogue is scripted for this scenelet.';
  }

  return scenelet.dialogue
    .map((line, index) => {
      const character = line?.character?.trim?.() ?? '';
      const text = line?.line?.trim?.() ?? '';
      if (!character || !text) {
        return `- ${index + 1}. [invalid dialogue line omitted]`;
      }
      return `- ${index + 1}. ${character}: ${text}`;
    })
    .join('\n');
}

function renderShotSuggestionsSection(scenelet: SceneletDigest): string {
  if (!Array.isArray(scenelet.shotSuggestions) || scenelet.shotSuggestions.length === 0) {
    return '- No director shot_suggestions were provided.';
  }

  return scenelet.shotSuggestions
    .map((suggestion, index) => {
      const text = suggestion?.trim?.() ?? '';
      if (!text) {
        return `- ${index + 1}. [empty suggestion omitted]`;
      }
      return `- ${index + 1}. ${text}`;
    })
    .join('\n');
}
