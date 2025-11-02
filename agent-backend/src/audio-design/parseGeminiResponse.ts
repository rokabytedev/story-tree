import { AudioDesignTaskError } from './errors.js';
import type {
  AudioDesignDocument,
  AudioDesignValidationResult,
  AudioMusicCue,
  AudioSonicIdentity,
  AudioVoiceProfile,
  NarratorVoiceProfile,
} from './types.js';
import type { StoryTreeSnapshot, SceneletDigest } from '../story-storage/types.js';
import { normalizeNameToId } from '../visual-design/utils.js';

interface AudioDesignResponseValidationContext {
  storyTree: StoryTreeSnapshot;
  visualDesignDocument: unknown;
}

interface RawAudioDesignPayload {
  [key: string]: unknown;
  sonic_identity?: unknown;
  sonicIdentity?: unknown;
  character_voice_profiles?: unknown;
  characterVoiceProfiles?: unknown;
  music_and_ambience_cues?: unknown;
  musicAndAmbienceCues?: unknown;
  narrator_voice_profile?: unknown;
  narratorVoiceProfile?: unknown;
}

export function parseAudioDesignResponse(
  raw: string,
  context: AudioDesignResponseValidationContext
): AudioDesignValidationResult {
  const trimmed = raw?.toString?.() ?? '';
  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new AudioDesignTaskError(
      `Gemini audio design response contained invalid JSON: ${summarizeRaw(trimmed)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AudioDesignTaskError(
      `Gemini audio design response is not an object: ${summarizeRaw(trimmed)}`
    );
  }

  const record = parsed as Record<string, unknown>;
  const payload = record.audio_design_document ?? record.audioDesignDocument;

  if (!payload || typeof payload !== 'object') {
    throw new AudioDesignTaskError(
      `Gemini audio design response missing audio_design_document object: ${summarizeRaw(trimmed)}`
    );
  }

  const root = payload as RawAudioDesignPayload;
  const sceneletMap = buildSceneletMap(context.storyTree);
  const requiredScenelets = computeDialogueScenelets(sceneletMap);
  const characterRoster = extractCharacterNames(context.visualDesignDocument);
  const rosterWithoutNarrator = new Set(characterRoster);
  rosterWithoutNarrator.delete('narrator');

  const sonicIdentity = parseSonicIdentity(root);
  const narratorVoiceProfile = parseNarratorVoiceProfile(root);
  const voiceProfiles = parseVoiceProfiles(root, rosterWithoutNarrator);
  const musicCues = parseMusicCues(root, {
    sceneletMap,
    requiredScenelets,
  });

  ensureSceneletCoverage(requiredScenelets, musicCues);

  const sanitized: AudioDesignDocument = {
    sonic_identity: sonicIdentity,
    narrator_voice_profile: narratorVoiceProfile,
    character_voice_profiles: voiceProfiles,
    music_and_ambience_cues: musicCues,
  };

  return {
    audioDesignDocument: sanitized,
  };
}

function parseSonicIdentity(root: RawAudioDesignPayload): AudioSonicIdentity {
  const source = (root.sonic_identity ?? root.sonicIdentity) as Record<string, unknown> | undefined;

  if (!source || typeof source !== 'object') {
    throw new AudioDesignTaskError('audio_design_document.sonic_identity must be an object.');
  }

  const musicalDirection = extractDetailedString(
    (source as Record<string, unknown>).musical_direction ??
      (source as Record<string, unknown>).musicalDirection,
    'sonic_identity.musical_direction',
    10
  );
  const soundEffects = extractDetailedString(
    (source as Record<string, unknown>).sound_effect_philosophy ??
      (source as Record<string, unknown>).soundEffectPhilosophy,
    'sonic_identity.sound_effect_philosophy',
    10
  );

  return {
    ...(typeof source === 'object' ? source : {}),
    musical_direction: musicalDirection,
    sound_effect_philosophy: soundEffects,
  };
}

function parseNarratorVoiceProfile(root: RawAudioDesignPayload): NarratorVoiceProfile {
  const source = (root.narrator_voice_profile ?? root.narratorVoiceProfile) as
    | Record<string, unknown>
    | undefined;

  if (!source || typeof source !== 'object') {
    throw new AudioDesignTaskError(
      'audio_design_document.narrator_voice_profile must be an object.'
    );
  }

  const voiceProfile = extractDetailedString(
    (source.voice_profile ?? source.voiceProfile) as unknown,
    'narrator_voice_profile.voice_profile',
    30
  );
  const voiceName = extractNonEmptyString(
    (source.voice_name ?? source.voiceName) as unknown,
    'narrator_voice_profile.voice_name'
  );

  const rawId = (source.character_id ?? source.characterId) as unknown;
  const characterId = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : 'narrator';

  if (characterId !== 'narrator') {
    throw new AudioDesignTaskError(
      'narrator_voice_profile.character_id must be "narrator".'
    );
  }

  const sanitized = {
    ...source,
    character_id: 'narrator',
    voice_name: voiceName,
    voice_profile: voiceProfile,
  } as NarratorVoiceProfile;

  delete (sanitized as Record<string, unknown>).characterId;
  delete (sanitized as Record<string, unknown>).voiceName;
  delete (sanitized as Record<string, unknown>).voiceProfile;

  return sanitized;
}

function parseVoiceProfiles(
  root: RawAudioDesignPayload,
  characterRoster: Set<string>
): AudioVoiceProfile[] {
  const raw = root.character_voice_profiles ?? root.characterVoiceProfiles;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AudioDesignTaskError(
      'audio_design_document.character_voice_profiles must be a non-empty array.'
    );
  }

  const seen = new Set<string>();
  const duplicates: Set<string> = new Set();
  const unexpected: Set<string> = new Set();
  const sanitized: AudioVoiceProfile[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new AudioDesignTaskError(
        `character_voice_profiles entry at index ${index} must be an object.`
      );
    }

    const record = entry as Record<string, unknown>;
    const characterName = extractNonEmptyString(
      record.character_name ?? record.characterName,
      `character_voice_profiles[${index}].character_name`
    );

    // Normalize character name to ID for matching against visual design document
    const characterId = normalizeNameToId(characterName);

    if (!characterRoster.has(characterId)) {
      unexpected.add(characterName);
    }

    if (seen.has(characterId)) {
      duplicates.add(characterName);
    }
    seen.add(characterId);

    const voiceName = extractNonEmptyString(
      record.voice_name ?? record.voiceName,
      `character_voice_profiles[${index}].voice_name`
    );

    const voiceProfileSource =
      record.voice_profile ??
      record.voiceProfile;

    const voiceProfile = extractDetailedString(
      voiceProfileSource,
      `character_voice_profiles[${index}].voice_profile`,
      30
    );

    const sanitizedProfile = {
      ...record,
      character_id: characterId,
      character_name: characterName,
      voice_profile: voiceProfile,
      voice_name: voiceName,
    } as AudioVoiceProfile;

    delete (sanitizedProfile as Record<string, unknown>).characterId;
    delete (sanitizedProfile as Record<string, unknown>).characterName;
    delete (sanitizedProfile as Record<string, unknown>).voiceProfile;
    delete (sanitizedProfile as Record<string, unknown>).voiceName;
    delete (sanitizedProfile as Record<string, unknown>).ttsGenerationPrompt;

    sanitized.push(sanitizedProfile);
  });

  const missing = [...characterRoster].filter((id) => !seen.has(id));
  const issues: string[] = [];
  if (unexpected.size > 0) {
    issues.push(
      `unexpected character_name(s): ${Array.from(unexpected.values()).join(', ')}`
    );
  }
  if (duplicates.size > 0) {
    issues.push(
      `duplicate character_name(s): ${Array.from(duplicates.values()).join(', ')}`
    );
  }
  if (missing.length > 0) {
    issues.push(`missing character profile(s): ${missing.join(', ')}`);
  }

  if (issues.length > 0) {
    throw new AudioDesignTaskError(`Audio design character voice profiles invalid: ${issues.join('; ')}`);
  }

  return sanitized;
}

function parseMusicCues(
  root: RawAudioDesignPayload,
  context: { sceneletMap: Map<string, SceneletDigest>; requiredScenelets: Set<string> }
): AudioMusicCue[] {
  const raw = root.music_and_ambience_cues ?? root.musicAndAmbienceCues;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AudioDesignTaskError(
      'audio_design_document.music_and_ambience_cues must be a non-empty array.'
    );
  }

  const sanitized: AudioMusicCue[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new AudioDesignTaskError(
        `music_and_ambience_cues entry at index ${index} must be an object.`
      );
    }

    const record = entry as Record<string, unknown>;
    const cueName = extractNonEmptyString(
      record.cue_name ?? record.cueName,
      `music_and_ambience_cues[${index}].cue_name`
    );
    const cueDescription = extractDetailedString(
      record.cue_description ?? record.cueDescription,
      `music_and_ambience_cues[${index}].cue_description`,
      10
    );
    const musicPrompt = extractDetailedString(
      record.music_generation_prompt ?? record.musicGenerationPrompt,
      `music_and_ambience_cues[${index}].music_generation_prompt`,
      10
    );

    const idsRaw = record.associated_scenelet_ids ?? record.associatedSceneletIds;
    if (!Array.isArray(idsRaw) || idsRaw.length === 0) {
      throw new AudioDesignTaskError(
        `music_and_ambience_cues[${index}].associated_scenelet_ids must be a non-empty array.`
      );
    }

    const ids: string[] = [];
    const idSet = new Set<string>();
    idsRaw.forEach((value, idIndex) => {
      const sceneletId = extractNonEmptyString(
        value,
        `music_and_ambience_cues[${index}].associated_scenelet_ids[${idIndex}]`
      );
      if (!context.sceneletMap.has(sceneletId)) {
        throw new AudioDesignTaskError(
          `music_and_ambience_cues[${index}] references unknown scenelet_id "${sceneletId}".`
        );
      }
      if (idSet.has(sceneletId)) {
        throw new AudioDesignTaskError(
          `music_and_ambience_cues[${index}] contains duplicate scenelet_id "${sceneletId}".`
        );
      }
      idSet.add(sceneletId);
      ids.push(sceneletId);

    });

    sanitized.push({
      ...record,
      cue_name: cueName,
      cue_description: cueDescription,
      music_generation_prompt: musicPrompt,
      associated_scenelet_ids: ids,
    });
  });

  // Coverage checked later by ensureSceneletCoverage

  return sanitized;
}

function ensureSceneletCoverage(
  requiredScenelets: Set<string>,
  cues: AudioMusicCue[]
): void {
  if (requiredScenelets.size === 0) {
    return;
  }

  const covered = new Set<string>();
  for (const cue of cues) {
    for (const id of cue.associated_scenelet_ids) {
      covered.add(id);
    }
  }

  const missing = [...requiredScenelets].filter((id) => !covered.has(id));
  if (missing.length > 0) {
    throw new AudioDesignTaskError(
      `Audio design cues missing coverage for scenelets: ${missing.join(', ')}`
    );
  }
}

function buildSceneletMap(snapshot: StoryTreeSnapshot): Map<string, SceneletDigest> {
  const map = new Map<string, SceneletDigest>();
  for (const entry of snapshot.entries) {
    if (entry.kind === 'scenelet') {
      map.set(entry.data.id, entry.data);
    }
  }

  if (map.size === 0) {
    throw new AudioDesignTaskError('Audio design validation requires at least one scenelet.');
  }

  return map;
}

function computeDialogueScenelets(scenelets: Map<string, SceneletDigest>): Set<string> {
  const ids = new Set<string>();

  for (const [sceneletId, scenelet] of scenelets.entries()) {
    if (!Array.isArray(scenelet.dialogue)) {
      continue;
    }

    const hasDialogue = scenelet.dialogue.some((line) => {
      const character = normalizeString(line?.character);
      const text = normalizeString(line?.line);
      return Boolean(character && text);
    });

    if (hasDialogue) {
      ids.add(sceneletId);
    }
  }

  return ids;
}

function extractCharacterNames(document: unknown): Set<string> {
  if (document === null || document === undefined) {
    throw new AudioDesignTaskError(
      'Visual design document is required before generating audio design.'
    );
  }

  let source: unknown = document;

  if (typeof document === 'string') {
    const trimmed = document.trim();
    if (!trimmed) {
      throw new AudioDesignTaskError('Visual design document string must not be empty.');
    }

    try {
      source = JSON.parse(trimmed);
    } catch (error) {
      throw new AudioDesignTaskError('Visual design document string must contain valid JSON.');
    }
  }

  if (!source || typeof source !== 'object') {
    throw new AudioDesignTaskError('Visual design document must be an object.');
  }

  const record = source as Record<string, unknown>;
  const designs = resolveCharacterDesigns(record);
  if (!Array.isArray(designs) || designs.length === 0) {
    throw new AudioDesignTaskError('Visual design document must include character designs.');
  }

  const roster = new Set<string>();
  designs.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const value = (entry as Record<string, unknown>).character_id ??
      (entry as Record<string, unknown>).characterId;
    const id = typeof value === 'string' ? value.trim() : '';
    if (id) {
      roster.add(id);
    }
  });

  if (roster.size === 0) {
    throw new AudioDesignTaskError(
      'Visual design document must include character_id values for every character.'
    );
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

function extractDetailedString(
  value: unknown,
  fieldPath: string,
  minimumLength: number
): string {
  const text = extractNonEmptyString(value, fieldPath);
  if (text.length < minimumLength) {
    throw new AudioDesignTaskError(
      `${fieldPath} must be at least ${minimumLength} characters long.`
    );
  }
  return text;
}

function extractNonEmptyString(value: unknown, fieldPath: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new AudioDesignTaskError(`${fieldPath} must be a non-empty string.`);
  }
  return normalized;
}

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
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
