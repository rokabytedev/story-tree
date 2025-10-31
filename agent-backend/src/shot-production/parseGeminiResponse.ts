import { ShotProductionTaskError } from './errors.js';
import {
  type AudioNarrativeEntry,
  type ShotProductionStoryboardEntry,
  type ShotProductionResponseValidationContext,
  type ShotProductionShotRecord,
  type ShotProductionValidationResult,
  type ReferencedDesigns,
} from './types.js';
import { normalizeNameToId } from '../visual-design/utils.js';

interface RawShotRecord {
  shot_index?: unknown;
  shotIndex?: unknown;
  storyboard_entry?: unknown;
  storyboardEntry?: unknown;
  [key: string]: unknown;
}

interface RawStoryboardEntry {
  framing_and_angle?: unknown;
  framingAndAngle?: unknown;
  composition_and_content?: unknown;
  compositionAndContent?: unknown;
  character_action_and_emotion?: unknown;
  characterActionAndEmotion?: unknown;
  dialogue?: unknown;
  camera_dynamics?: unknown;
  cameraDynamics?: unknown;
  lighting_and_atmosphere?: unknown;
  lightingAndAtmosphere?: unknown;
  continuity_notes?: unknown;
  continuityNotes?: unknown;
  referenced_designs?: unknown;
  referencedDesigns?: unknown;
  audio_and_narrative?: unknown;
  audioAndNarrative?: unknown;
  [key: string]: unknown;
}

interface RawAudioNarrativeEntry {
  type?: unknown;
  source?: unknown;
  line?: unknown;
  [key: string]: unknown;
}

interface ParsedResponse {
  scenelet_id?: unknown;
  sceneletId?: unknown;
  shots?: unknown;
  [key: string]: unknown;
}

export function parseShotProductionResponse(
  raw: string,
  context: ShotProductionResponseValidationContext
): ShotProductionValidationResult {
  const trimmed = raw?.toString?.() ?? '';
  let parsed: ParsedResponse;

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new ShotProductionTaskError(
      `Gemini shot production response contained invalid JSON: ${summarizeRaw(trimmed)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ShotProductionTaskError(
      `Gemini shot production response must be a JSON object: ${summarizeRaw(trimmed)}`
    );
  }

  const targetSceneletId = context.scenelet?.id?.trim?.();
  if (!targetSceneletId) {
    throw new ShotProductionTaskError('Shot production validator requires a target scenelet.');
  }

  const sceneletIdRaw = parsed.scenelet_id ?? parsed.sceneletId;
  const sceneletId = toTrimmedString(sceneletIdRaw);
  if (!sceneletId) {
    throw new ShotProductionTaskError('Gemini shot production response must include scenelet_id.');
  }

  if (sceneletId !== targetSceneletId) {
    throw new ShotProductionTaskError(
      `Gemini shot production response scenelet_id ${sceneletId} does not match requested ${targetSceneletId}.`
    );
  }

  const shotsRaw = parsed.shots;
  if (!Array.isArray(shotsRaw) || shotsRaw.length === 0) {
    throw new ShotProductionTaskError('Gemini shot production response must include at least one shot.');
  }

  const characterRoster = extractCharacterRoster(context.visualDesignDocument);
  const environmentRoster = extractEnvironmentRoster(context.visualDesignDocument);
  const dialogueLookup = buildDialogueLookup(context.scenelet.dialogue);

  const sanitizedShots: ShotProductionShotRecord[] = [];
  let expectedShotIndex = 1;

  for (const entry of shotsRaw) {
    const sanitized = sanitizeShot(entry, {
      expectedIndex: expectedShotIndex,
      characterRoster,
      environmentRoster,
      dialogueLookup,
    });
    sanitizedShots.push(sanitized);
    expectedShotIndex += 1;
  }

  return {
    sceneletId,
    shots: sanitizedShots,
  };
}

function sanitizeShot(
  input: unknown,
  context: {
    expectedIndex: number;
    characterRoster: Set<string>;
    environmentRoster: Set<string>;
    dialogueLookup: Set<string>;
  }
): ShotProductionShotRecord {
  if (!input || typeof input !== 'object') {
    throw new ShotProductionTaskError('Gemini shot production response contains a non-object shot entry.');
  }

  const record = input as RawShotRecord;
  const rawShotIndex = record.shot_index ?? record.shotIndex;
  const shotIndex = parseInteger(rawShotIndex);
  if (shotIndex === null) {
    throw new ShotProductionTaskError('Each shot must include a numeric shot_index.');
  }

  if (shotIndex !== context.expectedIndex) {
    throw new ShotProductionTaskError(
      `Shot indices must be sequential starting at 1. Expected ${context.expectedIndex} but received ${shotIndex}.`
    );
  }

  const storyboardRaw = record.storyboard_entry ?? record.storyboardEntry;
  const storyboard = sanitizeStoryboard(storyboardRaw, context);

  return {
    shotIndex,
    storyboard,
  };
}

function sanitizeStoryboard(
  input: unknown,
  context: {
    characterRoster: Set<string>;
    environmentRoster: Set<string>;
    dialogueLookup: Set<string>;
  }
): ShotProductionStoryboardEntry {
  if (!input || typeof input !== 'object') {
    throw new ShotProductionTaskError('Each shot must include a storyboard_entry object.');
  }

  const record = input as RawStoryboardEntry;

  const framingAndAngle = requireRichText(record.framing_and_angle ?? record.framingAndAngle, 'framing_and_angle');
  const compositionAndContent = requireRichText(
    record.composition_and_content ?? record.compositionAndContent,
    'composition_and_content'
  );
  const characterActionAndEmotion = requireRichText(
    record.character_action_and_emotion ?? record.characterActionAndEmotion,
    'character_action_and_emotion'
  );
  const cameraDynamics = requireRichText(record.camera_dynamics ?? record.cameraDynamics, 'camera_dynamics');
  const lightingAndAtmosphere = requireRichText(
    record.lighting_and_atmosphere ?? record.lightingAndAtmosphere,
    'lighting_and_atmosphere'
  );
  const continuityNotes = requireRichText(
    record.continuity_notes ?? record.continuityNotes,
    'continuity_notes'
  );

  const referencedDesignsRaw = record.referenced_designs ?? record.referencedDesigns;
  const referencedDesigns = sanitizeReferencedDesigns(referencedDesignsRaw, {
    characterRoster: context.characterRoster,
    environmentRoster: context.environmentRoster,
  });

  const audioNarrativeRaw = record.audio_and_narrative ?? record.audioAndNarrative;
  const audioAndNarrative = sanitizeAudioNarrative(audioNarrativeRaw, {
    characterRoster: context.characterRoster,
    dialogueLookup: context.dialogueLookup,
  });

  return {
    framingAndAngle,
    compositionAndContent,
    characterActionAndEmotion,
    cameraDynamics,
    lightingAndAtmosphere,
    continuityNotes,
    referencedDesigns,
    audioAndNarrative,
  };
}

function sanitizeAudioNarrative(
  input: unknown,
  context: {
    characterRoster: Set<string>;
    dialogueLookup: Set<string>;
  }
): AudioNarrativeEntry[] {
  if (!Array.isArray(input)) {
    throw new ShotProductionTaskError('storyboard_entry.audio_and_narrative must be an array.');
  }

  const sanitized: AudioNarrativeEntry[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') {
      throw new ShotProductionTaskError('storyboard_entry.audio_and_narrative entries must be objects.');
    }

    const record = entry as RawAudioNarrativeEntry;
    const typeRaw = toTrimmedString(record.type);
    const normalizedType = typeRaw.toLowerCase();
    if (!typeRaw) {
      throw new ShotProductionTaskError('audio_and_narrative.type must be provided.');
    }
    if (normalizedType !== 'monologue' && normalizedType !== 'dialogue') {
      throw new ShotProductionTaskError('audio_and_narrative.type must be either "monologue" or "dialogue".');
    }

    const source = toTrimmedString(record.source);
    if (!source) {
      throw new ShotProductionTaskError('audio_and_narrative.source must be a non-empty string.');
    }

    const line = requireRichText(record.line, 'audio_and_narrative.line');

    if (normalizedType === 'monologue') {
      if (source !== 'narrator') {
        throw new ShotProductionTaskError('Monologue entries must use source "narrator".');
      }
    } else {
      if (!context.characterRoster.has(source)) {
        throw new ShotProductionTaskError(`Dialogue references unknown character design id ${source}.`);
      }

      const key = buildDialogueKey(source, line);
      if (!context.dialogueLookup.has(key)) {
        throw new ShotProductionTaskError(
          `Dialogue line for character id ${source} does not exist in the target scenelet: "${line}"`
        );
      }
    }

    sanitized.push({
      type: normalizedType as AudioNarrativeEntry['type'],
      source,
      line,
    });
  }

  return sanitized;
}

function sanitizeReferencedDesigns(
  input: unknown,
  context: {
    characterRoster: Set<string>;
    environmentRoster: Set<string>;
  }
): ReferencedDesigns {
  if (!input || typeof input !== 'object') {
    throw new ShotProductionTaskError('referenced_designs must be an object.');
  }

  const record = input as Record<string, unknown>;
  const charactersRaw = record.characters;
  const environmentsRaw = record.environments;

  const characters = validateStringArray(charactersRaw, 'referenced_designs.characters');
  const environments = validateStringArray(environmentsRaw, 'referenced_designs.environments');

  const unknownCharacters = characters.filter((id) => !context.characterRoster.has(id));
  if (unknownCharacters.length > 0) {
    throw new ShotProductionTaskError(
      `referenced_designs.characters includes unknown design ids: ${unknownCharacters.join(', ')}.`
    );
  }

  const unknownEnvironments = environments.filter(
    (id) => context.environmentRoster.size > 0 && !context.environmentRoster.has(id)
  );
  if (unknownEnvironments.length > 0) {
    throw new ShotProductionTaskError(
      `referenced_designs.environments includes unknown design ids: ${unknownEnvironments.join(', ')}.`
    );
  }

  return {
    characters,
    environments,
  };
}

function validateStringArray(input: unknown, field: string): string[] {
  if (input === undefined || input === null) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new ShotProductionTaskError(`${field} must be an array when provided.`);
  }

  const validated: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') {
      throw new ShotProductionTaskError(`${field} array entries must be non-empty strings.`);
    }
    const str = item.trim();
    if (!str) {
      throw new ShotProductionTaskError(`${field} array entries must be non-empty strings.`);
    }
    validated.push(str);
  }

  return validated;
}

function requireRichText(value: unknown, field: string, minimumLength = 1): string {
  const text = toTrimmedString(value);
  if (!text) {
    throw new ShotProductionTaskError(`${field} must be a non-empty string.`);
  }

  if (text.length < minimumLength) {
    throw new ShotProductionTaskError(`${field} must be at least ${minimumLength} characters long.`);
  }

  return text;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  }

  return null;
}

function buildDialogueLookup(
  dialogue: Array<{ character: string; line: string }>
): Set<string> {
  const inventory = new Set<string>();

  for (const entry of dialogue ?? []) {
    const character = toTrimmedString(entry?.character);
    const line = toTrimmedString(entry?.line);

    if (!character || !line) {
      continue;
    }

    const characterId = normalizeNameToId(character);
    const key = buildDialogueKey(characterId, line);
    inventory.add(key);
  }

  return inventory;
}

function buildDialogueKey(character: string, line: string): string {
  return `${character}::${line}`;
}

function extractCharacterRoster(document: unknown): Set<string> {
  if (document === null || document === undefined) {
    throw new ShotProductionTaskError('Visual design document is required before validating shot production.');
  }

  let source: unknown = document;

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new ShotProductionTaskError('Visual design document string must not be empty.');
    }

    try {
      source = JSON.parse(trimmed);
    } catch (error) {
      throw new ShotProductionTaskError('Visual design document string must contain valid JSON.');
    }
  }

  if (!source || typeof source !== 'object') {
    throw new ShotProductionTaskError('Visual design document must be an object.');
  }

  const record = source as Record<string, unknown>;
  const candidates = resolveCharacterDesigns(record);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new ShotProductionTaskError('Visual design document must include at least one character design.');
  }

  const roster = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const id = toTrimmedString((candidate as Record<string, unknown>).character_id ?? (candidate as Record<string, unknown>).characterId);
    if (id) {
      roster.add(id);
    }
  }

  if (roster.size === 0) {
    throw new ShotProductionTaskError('Visual design document must include character_id fields.');
  }

  return roster;
}

function extractEnvironmentRoster(document: unknown): Set<string> {
  if (document === null || document === undefined) {
    return new Set<string>();
  }

  let source: unknown = document;

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      return new Set<string>();
    }

    try {
      source = JSON.parse(trimmed);
    } catch {
      return new Set<string>();
    }
  }

  if (!source || typeof source !== 'object') {
    return new Set<string>();
  }

  const record = source as Record<string, unknown>;
  const candidates = resolveEnvironmentDesigns(record);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return new Set<string>();
  }

  const roster = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const id = toTrimmedString(
      (candidate as Record<string, unknown>).environment_id ??
        (candidate as Record<string, unknown>).environmentId
    );
    if (id) {
      roster.add(id);
    }
  }

  return roster;
}

function resolveCharacterDesigns(record: Record<string, unknown>): unknown {
  if (Array.isArray(record.character_designs)) {
    return record.character_designs;
  }

  if (Array.isArray(record.characterDesigns)) {
    return record.characterDesigns;
  }

  if (record.visual_design_document && typeof record.visual_design_document === 'object') {
    return resolveCharacterDesigns(record.visual_design_document as Record<string, unknown>);
  }

  if (record.visualDesignDocument && typeof record.visualDesignDocument === 'object') {
    return resolveCharacterDesigns(record.visualDesignDocument as Record<string, unknown>);
  }

  return undefined;
}

function resolveEnvironmentDesigns(record: Record<string, unknown>): unknown {
  if (Array.isArray(record.environment_designs)) {
    return record.environment_designs;
  }

  if (Array.isArray(record.environmentDesigns)) {
    return record.environmentDesigns;
  }

  if (record.visual_design_document && typeof record.visual_design_document === 'object') {
    return resolveEnvironmentDesigns(record.visual_design_document as Record<string, unknown>);
  }

  if (record.visualDesignDocument && typeof record.visualDesignDocument === 'object') {
    return resolveEnvironmentDesigns(record.visualDesignDocument as Record<string, unknown>);
  }

  return undefined;
}

function toTrimmedString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  return '';
}

function summarizeRaw(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 200) {
    return trimmed || '[empty]';
  }
  return `${trimmed.slice(0, 197)}...`;
}
