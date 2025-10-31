import { ShotImageTaskError } from './errors.js';
import type { ShotRecord, ShotProductionStoryboardEntry } from '../shot-production/types.js';
import type {
  VisualDesignCharacterDesign,
  VisualDesignDocument,
  VisualDesignEnvironmentDesign,
} from '../visual-design/types.js';

interface GlobalAesthetic {
  visual_style: unknown;
  master_color_palette: unknown;
}

export interface AssembledKeyFramePrompt {
  global_aesthetic: GlobalAesthetic;
  character_designs: VisualDesignCharacterDesign[];
  environment_designs: VisualDesignEnvironmentDesign[];
  [key: string]: unknown;
}

export function assembleKeyFramePrompt(
  shot: ShotRecord,
  visualDesignDocument: VisualDesignDocument
): AssembledKeyFramePrompt {
  if (!shot) {
    throw new ShotImageTaskError('assembleKeyFramePrompt requires a shot record.');
  }

  const storyboard = extractStoryboard(shot.storyboardPayload);
  const referencedDesigns = storyboard.referencedDesigns;
  if (!referencedDesigns) {
    throw new ShotImageTaskError('Shot storyboard payload is missing referencedDesigns.');
  }

  const globalAesthetic = extractGlobalAesthetic(visualDesignDocument);
  const characterDesigns = filterCharacterDesigns(
    visualDesignDocument,
    referencedDesigns.characters ?? []
  );
  const environmentDesigns = filterEnvironmentDesigns(
    visualDesignDocument,
    referencedDesigns.environments ?? []
  );

  const { audioAndNarrative, ...visualInstructions } = storyboard;

  return {
    global_aesthetic: globalAesthetic,
    character_designs: characterDesigns,
    environment_designs: environmentDesigns,
    ...visualInstructions,
  };
}

function extractStoryboard(payload: unknown): ShotProductionStoryboardEntry {
  if (!payload || typeof payload !== 'object') {
    throw new ShotImageTaskError('Shot storyboard payload must be an object for prompt assembly.');
  }
  return payload as ShotProductionStoryboardEntry;
}

function extractGlobalAesthetic(document: VisualDesignDocument): GlobalAesthetic {
  if (!document || typeof document !== 'object') {
    throw new ShotImageTaskError('Visual design document must be provided to assemble prompts.');
  }

  const visualStyle =
    (document as Record<string, unknown>).visual_style ??
    (document as Record<string, unknown>).visualStyle;
  const masterPalette =
    (document as Record<string, unknown>).master_color_palette ??
    (document as Record<string, unknown>).masterColorPalette;

  if (visualStyle === undefined || masterPalette === undefined) {
    throw new ShotImageTaskError(
      'Visual design document is missing global aesthetic fields (visual_style or master_color_palette).'
    );
  }

  return {
    visual_style: visualStyle,
    master_color_palette: masterPalette,
  };
}

function filterCharacterDesigns(
  document: VisualDesignDocument,
  referencedIds: string[]
): VisualDesignCharacterDesign[] {
  const designs =
    document.character_designs ??
    document.characterDesigns ??
    [];

  return filterDesigns(designs, referencedIds, 'character', ['character_id', 'characterId']);
}

function filterEnvironmentDesigns(
  document: VisualDesignDocument,
  referencedIds: string[]
): VisualDesignEnvironmentDesign[] {
  const designs =
    document.environment_designs ??
    document.environmentDesigns ??
    [];

  return filterDesigns(designs, referencedIds, 'environment', ['environment_id', 'environmentId']);
}

function filterDesigns<T extends Record<string, unknown>>(
  designs: T[],
  referencedIds: string[],
  kind: 'character' | 'environment',
  idKeys: string[]
): T[] {
  if (referencedIds.length === 0) {
    return [];
  }

  const lookup = new Map<string, T>();

  for (const design of designs ?? []) {
    const id = resolveDesignId(design, idKeys);
    if (id) {
      lookup.set(id, design);
    }
  }

  const missing: string[] = [];
  const filtered: T[] = [];

  for (const id of referencedIds) {
    if (!id) {
      continue;
    }

    const trimmed = id.trim();
    if (!trimmed) {
      continue;
    }

    const design = lookup.get(trimmed);
    if (!design) {
      missing.push(trimmed);
      continue;
    }

    filtered.push(design);
  }

  if (missing.length > 0) {
    throw new ShotImageTaskError(
      `Shot referenced ${kind} design ids that do not exist in the visual design document: ${missing.join(
        ', '
      )}.`
    );
  }

  return filtered;
}

function resolveDesignId(design: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = design[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return undefined;
}
