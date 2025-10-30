import { ShotProductionTaskError } from './errors.js';
import {
  MIN_PROMPT_LENGTH,
  REQUIRED_VIDEO_CLIP_PHRASE,
  type ShotProductionDialogueLine,
  type ShotProductionStoryboardEntry,
  type ShotProductionResponseValidationContext,
  type ShotProductionShotRecord,
  type ShotProductionValidationResult,
  type ShotGenerationPrompts,
} from './types.js';
import { normalizeNameToId } from '../visual-design/utils.js';

interface RawShotRecord {
  shot_index?: unknown;
  shotIndex?: unknown;
  storyboard_entry?: unknown;
  storyboardEntry?: unknown;
  generation_prompts?: unknown;
  generationPrompts?: unknown;
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
  [key: string]: unknown;
}

interface RawPromptBundle {
  first_frame_prompt?: unknown;
  firstFramePrompt?: unknown;
  key_frame_storyboard_prompt?: unknown;
  keyFrameStoryboardPrompt?: unknown;
  key_frame_prompt?: unknown;
  keyFramePrompt?: unknown;
  video_clip_prompt?: unknown;
  videoClipPrompt?: unknown;
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

  const roster = extractCharacterRoster(context.visualDesignDocument);
  const dialogueLookup = buildDialogueLookup(context.scenelet.dialogue);

  const sanitizedShots: ShotProductionShotRecord[] = [];
  let expectedShotIndex = 1;

  for (const entry of shotsRaw) {
    const sanitized = sanitizeShot(entry, {
      expectedIndex: expectedShotIndex,
      roster,
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
    roster: Set<string>;
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

  const promptsRaw = record.generation_prompts ?? record.generationPrompts;
  const prompts = sanitizePrompts(promptsRaw);

  return {
    shotIndex,
    storyboard,
    prompts,
  };
}

function sanitizeStoryboard(
  input: unknown,
  context: {
    roster: Set<string>;
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

  const dialogueRaw = record.dialogue;
  const dialogue = sanitizeDialogue(dialogueRaw, context);

  return {
    framingAndAngle,
    compositionAndContent,
    characterActionAndEmotion,
    dialogue,
    cameraDynamics,
    lightingAndAtmosphere,
    continuityNotes,
  };
}

function sanitizeDialogue(
  input: unknown,
  context: {
    roster: Set<string>;
    dialogueLookup: Set<string>;
  }
): ShotProductionDialogueLine[] {
  if (input === undefined || input === null) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new ShotProductionTaskError('storyboard_entry.dialogue must be an array when provided.');
  }

  const sanitized: ShotProductionDialogueLine[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') {
      throw new ShotProductionTaskError('storyboard_entry.dialogue entries must be objects.');
    }

    const character = toTrimmedString((entry as Record<string, unknown>).character);
    const line = toTrimmedString((entry as Record<string, unknown>).line);

    if (!character || !line) {
      throw new ShotProductionTaskError('storyboard_entry.dialogue entries must include character and line strings.');
    }

    // Normalize character name to ID for matching against visual design document
    const characterId = normalizeNameToId(character);
    if (!context.roster.has(characterId)) {
      throw new ShotProductionTaskError(`Dialogue references unknown character ${character}.`);
    }

    const key = buildDialogueKey(character, line);
    if (!context.dialogueLookup.has(key)) {
      throw new ShotProductionTaskError(
        `Dialogue line for ${character} does not exist in the target scenelet: "${line}"`
      );
    }

    sanitized.push({ character, line });
  }

  return sanitized;
}

function sanitizePrompts(input: unknown): ShotGenerationPrompts {
  if (!input || typeof input !== 'object') {
    throw new ShotProductionTaskError('generation_prompts must be an object.');
  }

  const record = input as RawPromptBundle;
  const firstFramePrompt = requirePrompt(record.first_frame_prompt ?? record.firstFramePrompt, 'first_frame_prompt');
  const keyFramePromptCandidates =
    record.key_frame_storyboard_prompt ?? record.keyFrameStoryboardPrompt ?? record.key_frame_prompt ?? record.keyFramePrompt;
  const keyFramePrompt = requirePrompt(keyFramePromptCandidates, 'key_frame_storyboard_prompt');
  const videoClipPrompt = requirePrompt(record.video_clip_prompt ?? record.videoClipPrompt, 'video_clip_prompt', {
    enforcePhrase: REQUIRED_VIDEO_CLIP_PHRASE,
  });

  return {
    firstFramePrompt,
    keyFramePrompt,
    videoClipPrompt,
  };
}

function requirePrompt(
  value: unknown,
  field: string,
  options: { enforcePhrase?: string } = {}
): string {
  const text = requireRichText(value, field, MIN_PROMPT_LENGTH);

  if (options.enforcePhrase && !text.includes(options.enforcePhrase)) {
    throw new ShotProductionTaskError(
      `${field} must include the exact phrase "${options.enforcePhrase}".`
    );
  }

  return text;
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

    const key = buildDialogueKey(character, line);
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
