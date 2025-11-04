import { ShotVideoTaskError } from './errors.js';
import type {
  ShotRecord,
  ShotProductionStoryboardEntry,
  AudioNarrativeEntry,
} from '../shot-production/types.js';
import type {
  VisualDesignCharacterDesign,
  VisualDesignDocument,
  VisualDesignEnvironmentDesign,
} from '../visual-design/types.js';
import type {
  AudioDesignDocument,
  AudioVoiceProfile,
  NarratorVoiceProfile,
} from '../audio-design/types.js';

export interface AssembledShotVideoPrompt {
  global_aesthetic: Record<string, unknown>;
  character_designs: VisualDesignCharacterDesign[];
  environment_designs: VisualDesignEnvironmentDesign[];
  audio_design: ShotVideoAudioDesignSection;
  storyboard_payload: ShotProductionStoryboardEntry;
  critical_instruction: string[];
}

export function assembleShotVideoPrompt(
  shot: ShotRecord,
  visualDesignDocument: VisualDesignDocument,
  audioDesignDocument: AudioDesignDocument
): AssembledShotVideoPrompt {
  if (!shot) {
    throw new ShotVideoTaskError('assembleShotVideoPrompt requires a shot record.');
  }

  const storyboard = extractStoryboard(shot.storyboardPayload);
  const referencedDesigns = storyboard.referencedDesigns;
  if (!referencedDesigns) {
    throw new ShotVideoTaskError('Shot storyboard payload is missing referencedDesigns.');
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
  const audioDesign = assembleAudioDesignSection(
    audioDesignDocument,
    storyboard,
    referencedDesigns.characters ?? []
  );

  const sanitizedCharacterDesigns = redactCharacterModelSheetPaths(characterDesigns);
  const sanitizedEnvironmentDesigns = redactEnvironmentReferenceImagePaths(
    redactEnvironmentAssociatedSceneletIds(environmentDesigns)
  );

  return {
    global_aesthetic: globalAesthetic,
    character_designs: sanitizedCharacterDesigns,
    environment_designs: sanitizedEnvironmentDesigns,
    audio_design: audioDesign,
    storyboard_payload: storyboard,
    critical_instruction: [
      '**Character Model Sheets = Immutable Law.** The provided character reference images are the absolute, pixel-for-pixel ground truth for those characters. They define the permanent, unchangeable geometry, texture, color, markings, and attire. This data is **IMMUTABLE**.',
      '**Environment Reference Images = The Inspirational Blueprint.** The environment reference images (in a 2x2 grid) establish the *aesthetic and thematic consistency* of a location. They define the mood, color palette, lighting style, textures, and the "kit of parts" (e.g., types of trees, style of furniture). They are a stylistic guide, **not a compositional mandate**.',
      '**DO NOT** generate any captions, subtitles, or watermarks.',
      '**DO NOT** generate any background music.',
      "**IMPORTANT AUDIO RULE**: If the `source` of a `line` in `audioAndNarrative` is `narrator`, this designates a NON-DIEGETIC voice-over. The on-screen characters **MUST NOT** speak or lip-sync to this audio. Their actions should be independent of the act of speaking. The audio is for the audience only.",
    ],
  };
}

interface ShotVideoAudioDesignSection {
  sonic_identity?: Record<string, unknown>;
  narrator_voice_profile?: NarratorVoiceProfile | Record<string, unknown>;
  character_voice_profiles: AudioVoiceProfile[];
}

function assembleAudioDesignSection(
  audioDesign: AudioDesignDocument,
  storyboard: ShotProductionStoryboardEntry,
  referencedCharacterIds: string[]
): ShotVideoAudioDesignSection {
  if (!audioDesign || typeof audioDesign !== 'object') {
    throw new ShotVideoTaskError('Audio design document must be provided to assemble prompts.');
  }

  const section: ShotVideoAudioDesignSection = {
    character_voice_profiles: [],
  };

  const audioRecord = audioDesign as Record<string, unknown>;

  const sonicIdentityRecord = resolveRecord(audioRecord, ['sonic_identity', 'sonicIdentity']);
  const soundEffectPhilosophy = resolveString(sonicIdentityRecord, [
    'sound_effect_philosophy',
    'soundEffectPhilosophy',
  ]);
  if (soundEffectPhilosophy) {
    section.sonic_identity = {
      sound_effect_philosophy: soundEffectPhilosophy,
    };
  }

  const narrator = resolveRecord(audioRecord, ['narrator_voice_profile', 'narratorVoiceProfile']);
  if (narrator) {
    section.narrator_voice_profile = narrator as NarratorVoiceProfile | Record<string, unknown>;
  }

  const speakers = extractNarrativeSpeakers(storyboard?.audioAndNarrative ?? []);

  const referenced = referencedCharacterIds
    ?.map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));

  const narratorPresent = speakers.has('narrator');
  if (narratorPresent && section.narrator_voice_profile) {
    // already assigned narrator when available in document; nothing else required here.
  } else if (!narratorPresent) {
    delete section.narrator_voice_profile;
  }

  if (!referenced || referenced.length === 0) {
    section.character_voice_profiles = [];
    return section;
  }

  const profileLookup = buildVoiceProfileLookup(audioDesign.character_voice_profiles);

  const selectedProfiles: AudioVoiceProfile[] = [];
  for (const characterId of referenced) {
    if (!speakers.has(characterId)) {
      continue;
    }
    const profile = profileLookup.get(characterId);
    if (profile) {
      selectedProfiles.push(profile);
    }
  }

  section.character_voice_profiles = selectedProfiles;
  return section;
}

function extractNarrativeSpeakers(entries: AudioNarrativeEntry[] | undefined): Set<string> {
  const speakers = new Set<string>();
  if (!Array.isArray(entries)) {
    return speakers;
  }

  for (const entry of entries) {
    const source = entry?.source;
    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (trimmed) {
        speakers.add(trimmed);
      }
    }
  }

  return speakers;
}

function buildVoiceProfileLookup(
  profiles: AudioVoiceProfile[] | undefined
): Map<string, AudioVoiceProfile> {
  const lookup = new Map<string, AudioVoiceProfile>();
  if (!Array.isArray(profiles)) {
    return lookup;
  }

  for (const profile of profiles) {
    if (!profile || typeof profile !== 'object') {
      continue;
    }

    const record = profile as AudioVoiceProfile & Record<string, unknown>;
    const id = resolveString(record, ['character_id', 'characterId']);
    if (!id) {
      continue;
    }

    const normalized = id.trim();
    if (!normalized) {
      continue;
    }

    const cloned = { ...record } as AudioVoiceProfile & Record<string, unknown>;
    if (!cloned.character_id && cloned.characterId) {
      cloned.character_id = cloned.characterId as string;
    }
    if (Object.prototype.hasOwnProperty.call(cloned, 'characterId')) {
      delete cloned.characterId;
    }
    lookup.set(normalized, cloned as AudioVoiceProfile);
  }

  return lookup;
}

function extractStoryboard(payload: unknown): ShotProductionStoryboardEntry {
  if (!payload || typeof payload !== 'object') {
    throw new ShotVideoTaskError('Shot storyboard payload must be an object for prompt assembly.');
  }

  return payload as ShotProductionStoryboardEntry;
}

function extractGlobalAesthetic(document: VisualDesignDocument): Record<string, unknown> {
  if (!document || typeof document !== 'object') {
    throw new ShotVideoTaskError('Visual design document must be provided to assemble prompts.');
  }

  const record = document as Record<string, unknown> & {
    global_aesthetic?: Record<string, unknown>;
  };

  const globalAesthetic = record.global_aesthetic;

  const visualStyle =
    globalAesthetic?.visual_style ??
    globalAesthetic?.visualStyle ??
    record.visual_style ??
    record.visualStyle;

  const masterPalette =
    globalAesthetic?.master_color_palette ??
    globalAesthetic?.masterColorPalette ??
    record.master_color_palette ??
    record.masterColorPalette;

  if (visualStyle === undefined || masterPalette === undefined) {
    throw new ShotVideoTaskError(
      'Visual design document is missing global aesthetic fields (visual_style or master_color_palette).'
    );
  }

  if (globalAesthetic && typeof globalAesthetic === 'object') {
    return {
      ...globalAesthetic,
      visual_style: visualStyle,
      master_color_palette: masterPalette,
    };
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
  const designs = document.character_designs ?? document.characterDesigns ?? [];
  return filterDesigns(designs, referencedIds, 'character', ['character_id', 'characterId']);
}

function filterEnvironmentDesigns(
  document: VisualDesignDocument,
  referencedIds: string[]
): VisualDesignEnvironmentDesign[] {
  const designs = document.environment_designs ?? document.environmentDesigns ?? [];
  return filterDesigns(designs, referencedIds, 'environment', ['environment_id', 'environmentId']);
}

function filterDesigns<T extends Record<string, unknown>>(
  designs: T[],
  referencedIds: string[],
  kind: 'character' | 'environment',
  idKeys: string[]
): T[] {
  if (!Array.isArray(referencedIds) || referencedIds.length === 0) {
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
    throw new ShotVideoTaskError(
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
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function redactCharacterModelSheetPaths(
  characterDesigns: VisualDesignCharacterDesign[]
): VisualDesignCharacterDesign[] {
  return characterDesigns.map((design) => {
    if (!design || typeof design !== 'object') {
      return design;
    }

    const cloned = { ...design } as Record<string, unknown>;
    let mutated = false;

    if (Object.prototype.hasOwnProperty.call(cloned, 'character_model_sheet_image_path')) {
      delete cloned['character_model_sheet_image_path'];
      mutated = true;
    }

    if (Object.prototype.hasOwnProperty.call(cloned, 'characterModelSheetImagePath')) {
      delete cloned['characterModelSheetImagePath'];
      mutated = true;
    }

    return mutated ? (cloned as VisualDesignCharacterDesign) : design;
  });
}

function redactEnvironmentAssociatedSceneletIds(
  environmentDesigns: VisualDesignEnvironmentDesign[]
): VisualDesignEnvironmentDesign[] {
  return environmentDesigns.map((design) => {
    if (!design || typeof design !== 'object') {
      return design;
    }

    const cloned = { ...design } as Record<string, unknown>;
    let mutated = false;

    if (Object.prototype.hasOwnProperty.call(cloned, 'associated_scenelet_ids')) {
      delete cloned['associated_scenelet_ids'];
      mutated = true;
    }

    if (Object.prototype.hasOwnProperty.call(cloned, 'associatedSceneletIds')) {
      delete cloned['associatedSceneletIds'];
      mutated = true;
    }

    return mutated ? (cloned as VisualDesignEnvironmentDesign) : design;
  });
}

function redactEnvironmentReferenceImagePaths(
  environmentDesigns: VisualDesignEnvironmentDesign[]
): VisualDesignEnvironmentDesign[] {
  return environmentDesigns.map((design) => {
    if (!design || typeof design !== 'object') {
      return design;
    }

    const cloned = { ...design } as Record<string, unknown>;
    let mutated = false;

    if (Object.prototype.hasOwnProperty.call(cloned, 'environment_reference_image_path')) {
      delete cloned['environment_reference_image_path'];
      mutated = true;
    }

    if (Object.prototype.hasOwnProperty.call(cloned, 'environmentReferenceImagePath')) {
      delete cloned['environmentReferenceImagePath'];
      mutated = true;
    }

    return mutated ? (cloned as VisualDesignEnvironmentDesign) : design;
  });
}

function resolveRecord(
  input: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }

  for (const key of keys) {
    const value = input[key];
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }
  }

  return undefined;
}

function resolveString(input: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!input) {
    return undefined;
  }

  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return undefined;
}
