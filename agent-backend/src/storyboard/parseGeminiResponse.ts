import { StoryboardTaskError } from './errors.js';
import type { StoryboardDialogueLine, StoryboardShotRecord, StoryboardValidationResult } from './types.js';
import type { StoryTreeSnapshot, SceneletDigest } from '../story-storage/types.js';

interface StoryboardResponseValidationContext {
  storyTree: StoryTreeSnapshot;
  visualDesignDocument: unknown;
}

interface StoryboardRawShot {
  scenelet_id?: unknown;
  sceneletId?: unknown;
  shot_index?: unknown;
  shotIndex?: unknown;
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
  [key: string]: unknown;
}

export function parseStoryboardResponse(
  raw: string,
  context: StoryboardResponseValidationContext
): StoryboardValidationResult {
  const trimmed = raw?.toString?.() ?? '';
  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new StoryboardTaskError(
      `Gemini storyboard response contained invalid JSON: ${summarizeRaw(trimmed)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new StoryboardTaskError(
      `Gemini storyboard response is not an object: ${summarizeRaw(trimmed)}`
    );
  }

  const record = parsed as Record<string, unknown>;
  const breakdownRaw = record.storyboard_breakdown ?? record.storyboardBreakdown;

  if (!Array.isArray(breakdownRaw)) {
    throw new StoryboardTaskError(
      `Gemini storyboard response must include storyboard_breakdown array: ${summarizeRaw(trimmed)}`
    );
  }

  const sceneletMap = buildSceneletMap(context.storyTree);
  const dialogueCoverage = buildDialogueCoverage(sceneletMap);
  const characterRoster = extractCharacterNames(context.visualDesignDocument);
  const sceneletShotProgress = new Map<string, number>();
  const sanitizedShots: StoryboardShotRecord[] = [];

  breakdownRaw.forEach((shotRaw, index) => {
    const normalized = sanitizeShot(shotRaw, { index, sceneletMap, characterRoster, sceneletShotProgress, dialogueCoverage });
    sanitizedShots.push(normalized);
  });

  ensureDialogueCoverageSatisfied(dialogueCoverage);

  if (sanitizedShots.length === 0) {
    throw new StoryboardTaskError('Gemini storyboard response must include at least one shot.');
  }

  return {
    storyboardBreakdown: sanitizedShots,
  };
}

function buildSceneletMap(snapshot: StoryTreeSnapshot): Map<string, SceneletDigest> {
  const map = new Map<string, SceneletDigest>();

  for (const entry of snapshot.entries) {
    if (entry.kind === 'scenelet') {
      map.set(entry.data.id, entry.data);
    }
  }

  if (map.size === 0) {
    throw new StoryboardTaskError('Storyboard validation requires at least one scenelet in the story tree.');
  }

  return map;
}

function buildDialogueCoverage(scenelets: Map<string, SceneletDigest>): Map<string, Map<string, number>> {
  const coverage = new Map<string, Map<string, number>>();

  for (const [sceneletId, scenelet] of scenelets.entries()) {
    const dialogueMap = new Map<string, number>();

    for (const line of scenelet.dialogue) {
      const character = normalizeString(line.character);
      const text = normalizeString(line.line);

      if (!character || !text) {
        continue;
      }

      const key = buildDialogueKey(character, text);
      const count = dialogueMap.get(key) ?? 0;
      dialogueMap.set(key, count + 1);
    }

    coverage.set(sceneletId, dialogueMap);
  }

  return coverage;
}

function extractCharacterNames(document: unknown): Set<string> {
  if (document === null || document === undefined) {
    throw new StoryboardTaskError('Visual design document is required before generating the storyboard.');
  }

  let source: unknown = document;

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new StoryboardTaskError('Visual design document string must not be empty.');
    }

    try {
      source = JSON.parse(trimmed);
    } catch (error) {
      throw new StoryboardTaskError('Visual design document string must contain valid JSON.');
    }
  }

  if (!source || typeof source !== 'object') {
    throw new StoryboardTaskError('Visual design document must be an object representing the design payload.');
  }

  const record = source as Record<string, unknown>;
  const candidates = resolveCharacterDesigns(record);
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new StoryboardTaskError('Visual design document must include at least one character design.');
  }

  const roster = new Set<string>();
  for (const entry of candidates) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const characterName = extractCharacterName(entry as Record<string, unknown>);
    if (!characterName) {
      continue;
    }
    roster.add(characterName);
  }

  if (roster.size === 0) {
    throw new StoryboardTaskError('Visual design document must include character_name fields for validation.');
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

function extractCharacterName(record: Record<string, unknown>): string | null {
  const value = record.character_name ?? record.characterName;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeShot(
  shotRaw: unknown,
  context: {
    index: number;
    sceneletMap: Map<string, SceneletDigest>;
    characterRoster: Set<string>;
    sceneletShotProgress: Map<string, number>;
    dialogueCoverage: Map<string, Map<string, number>>;
  }
): StoryboardShotRecord {
  if (!shotRaw || typeof shotRaw !== 'object') {
    throw new StoryboardTaskError(`Storyboard shot at index ${context.index} is not an object.`);
  }

  const raw = shotRaw as StoryboardRawShot;
  const sceneletIdRaw = raw.scenelet_id ?? raw.sceneletId;
  const sceneletId = normalizeString(sceneletIdRaw);
  if (!sceneletId) {
    throw new StoryboardTaskError(`Storyboard shot at index ${context.index} is missing scenelet_id.`);
  }

  if (!context.sceneletMap.has(sceneletId)) {
    throw new StoryboardTaskError(
      `Storyboard shot references unknown scenelet_id "${sceneletId}".`
    );
  }

  const shotIndexRaw = raw.shot_index ?? raw.shotIndex;
  const shotIndex = normalizeShotIndex(shotIndexRaw, context.index, sceneletId);
  enforceShotOrdering(sceneletId, shotIndex, context.sceneletShotProgress);

  const framing = extractNonEmptyString(raw.framing_and_angle ?? raw.framingAndAngle, 'framing_and_angle', context.index);
  const composition = extractNonEmptyString(raw.composition_and_content ?? raw.compositionAndContent, 'composition_and_content', context.index);
  const action = extractNonEmptyString(
    raw.character_action_and_emotion ?? raw.characterActionAndEmotion,
    'character_action_and_emotion',
    context.index
  );
  const camera = extractNonEmptyString(raw.camera_dynamics ?? raw.cameraDynamics, 'camera_dynamics', context.index);
  const lighting = extractNonEmptyString(
    raw.lighting_and_atmosphere ?? raw.lightingAndAtmosphere,
    'lighting_and_atmosphere',
    context.index
  );

  const dialogue = sanitizeDialogue(
    raw.dialogue,
    context.index,
    sceneletId,
    context.characterRoster,
    context.dialogueCoverage
  );

  return {
    scenelet_id: sceneletId,
    shot_index: shotIndex,
    framing_and_angle: framing,
    composition_and_content: composition,
    character_action_and_emotion: action,
    dialogue,
    camera_dynamics: camera,
    lighting_and_atmosphere: lighting,
  };
}

function sanitizeDialogue(
  value: unknown,
  shotIndex: number,
  sceneletId: string,
  roster: Set<string>,
  coverage: Map<string, Map<string, number>>
): StoryboardDialogueLine[] {
  if (value === null || value === undefined) {
    throw new StoryboardTaskError(
      `Storyboard shot for ${sceneletId} (index ${shotIndex}) must include a dialogue array.`
    );
  }

  if (!Array.isArray(value)) {
    throw new StoryboardTaskError(
      `Storyboard shot for ${sceneletId} (index ${shotIndex}) dialogue must be an array.`
    );
  }

  const dialogueMap = coverage.get(sceneletId) ?? new Map<string, number>();
  const sanitized: StoryboardDialogueLine[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (!entry || typeof entry !== 'object') {
      throw new StoryboardTaskError(
        `Dialogue entry ${index} for scenelet ${sceneletId} is not an object.`
      );
    }

    const record = entry as Record<string, unknown>;
    const characterRaw = record.character;
    const lineRaw = record.line;
    const character = normalizeString(characterRaw);
    const line = normalizeString(lineRaw);

    if (!character) {
      throw new StoryboardTaskError(
        `Dialogue entry ${index} for scenelet ${sceneletId} is missing character name.`
      );
    }

    if (!line) {
      throw new StoryboardTaskError(
        `Dialogue entry ${index} for scenelet ${sceneletId} is missing dialogue line.`
      );
    }

    if (!roster.has(character)) {
      throw new StoryboardTaskError(
        `Dialogue entry for scenelet ${sceneletId} references unknown character "${character}".`
      );
    }

    const key = buildDialogueKey(character, line);
    const remaining = dialogueMap.get(key) ?? 0;
    if (remaining <= 0) {
      throw new StoryboardTaskError(
        `Dialogue line "${line}" for ${character} in scenelet ${sceneletId} does not match the interactive script or is assigned multiple times.`
      );
    }

    dialogueMap.set(key, remaining - 1);
    sanitized.push({ character, line });
  }

  return sanitized;
}

function ensureDialogueCoverageSatisfied(coverage: Map<string, Map<string, number>>): void {
  const uncovered: string[] = [];

  for (const [sceneletId, map] of coverage.entries()) {
    for (const [key, remaining] of map.entries()) {
      if (remaining > 0) {
        const { character, line } = parseDialogueKey(key);
        uncovered.push(`scenelet ${sceneletId}: ${character} - "${line}"`);
      }
    }
  }

  if (uncovered.length > 0) {
    throw new StoryboardTaskError(
      `Storyboard response did not cover all dialogue lines: ${uncovered.join('; ')}`
    );
  }
}

function enforceShotOrdering(
  sceneletId: string,
  shotIndex: number,
  progress: Map<string, number>
): void {
  const previous = progress.get(sceneletId);
  if (previous === undefined) {
    if (shotIndex !== 1) {
      throw new StoryboardTaskError(
        `First shot for scenelet ${sceneletId} must have shot_index 1.`
      );
    }
  } else if (shotIndex !== previous + 1) {
    throw new StoryboardTaskError(
      `Shot_index for scenelet ${sceneletId} must increment by 1. Expected ${previous + 1}, received ${shotIndex}.`
    );
  }

  progress.set(sceneletId, shotIndex);
}

function normalizeShotIndex(value: unknown, globalIndex: number, sceneletId: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new StoryboardTaskError(
        `Storyboard shot at index ${globalIndex} has empty shot_index.`
      );
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new StoryboardTaskError(
        `Storyboard shot at index ${globalIndex} must have a positive integer shot_index.`
      );
    }

    return parsed;
  }

  throw new StoryboardTaskError(
    `Storyboard shot at index ${globalIndex} must include numeric shot_index.`
  );
}

function extractNonEmptyString(value: unknown, field: string, shotIndex: number): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new StoryboardTaskError(
      `Storyboard shot at index ${shotIndex} must include non-empty ${field}.`
    );
  }
  return normalized;
}

function normalizeString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString().trim();
  }
  return '';
}

function buildDialogueKey(character: string, line: string): string {
  return `${character}\u0000${line}`;
}

function parseDialogueKey(key: string): { character: string; line: string } {
  const [character, line] = key.split('\u0000');
  return {
    character: character ?? '',
    line: line ?? '',
  };
}

function summarizeRaw(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '[empty response]';
  }

  if (trimmed.length <= 200) {
    return trimmed;
  }

  return `${trimmed.slice(0, 197)}...`;
}
