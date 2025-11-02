type UnknownRecord = Record<string, unknown>;

export interface AudioSonicIdentityViewModel {
  musicalDirection?: string | null;
  soundEffectPhilosophy?: string | null;
  additionalNotes?: string | null;
}

export interface AudioVoiceProfileViewModel {
  characterId: string;
  characterName?: string | null;
  voiceName?: string | null;
  voiceProfile?: string | null;
  usageNotes?: string | null;
  isNarrator?: boolean;
}

export interface AudioCueViewModel {
  cueName: string;
  description?: string | null;
  prompt?: string | null;
  sceneletIds: string[];
  audioFilePath?: string | null;
}

export interface AudioDesignViewModel {
  sonicIdentity: AudioSonicIdentityViewModel | null;
  narratorProfile: AudioVoiceProfileViewModel | null;
  characterProfiles: AudioVoiceProfileViewModel[];
  musicCues: AudioCueViewModel[];
  raw: UnknownRecord | null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function coerceString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => coerceString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const single = coerceString(value);
  return single ? [single] : [];
}

function getNestedRecord(value: UnknownRecord, ...keys: string[]): UnknownRecord | null {
  for (const key of keys) {
    const candidate = value[key];
    if (isRecord(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveAudioDocumentRoot(data: unknown): UnknownRecord | null {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return resolveAudioDocumentRoot(parsed);
    } catch {
      return null;
    }
  }

  if (!isRecord(data)) {
    return null;
  }

  const embedded = data.audio_design_document ?? data.audioDesignDocument;
  if (isRecord(embedded)) {
    return embedded;
  }

  return data;
}

function parseSonicIdentity(record: UnknownRecord): AudioSonicIdentityViewModel | null {
  const container = getNestedRecord(record, "sonic_identity", "sonicIdentity");
  if (!container) {
    return null;
  }

  const musicalDirection = coerceString(
    container.musical_direction ?? container.musicalDirection ?? container.direction
  );
  const soundEffectPhilosophy = coerceString(
    container.sound_effect_philosophy ??
      container.soundEffectPhilosophy ??
      container.fx_philosophy
  );
  const additionalNotes = coerceString(container.additional_notes ?? container.notes);

  if (!musicalDirection && !soundEffectPhilosophy && !additionalNotes) {
    return null;
  }

  return {
    musicalDirection,
    soundEffectPhilosophy,
    additionalNotes,
  };
}

function parseNarratorProfile(record: UnknownRecord): AudioVoiceProfileViewModel | null {
  const narrator = getNestedRecord(
    record,
    "narrator_voice_profile",
    "narratorVoiceProfile",
    "narrator_profile"
  );

  if (!narrator) {
    return null;
  }

  const voiceName = coerceString(narrator.voice_name ?? narrator.voiceName);
  const voiceProfile =
    coerceString(narrator.voice_profile ?? narrator.voiceProfile) ??
    coerceString(narrator.voice_description ?? narrator.voiceDescription);
  const usageNotes = coerceString(narrator.usage_notes ?? narrator.usageNotes ?? narrator.notes);

  if (!voiceName && !voiceProfile && !usageNotes) {
    return null;
  }

  return {
    characterId: coerceString(narrator.character_id ?? narrator.characterId ?? "narrator") ?? "narrator",
    characterName: "Narrator",
    voiceName,
    voiceProfile,
    usageNotes,
    isNarrator: true,
  };
}

function parseVoiceProfiles(record: UnknownRecord): AudioVoiceProfileViewModel[] {
  const profiles =
    (record.character_voice_profiles ?? record.characterVoiceProfiles) ?? [];

  if (!Array.isArray(profiles)) {
    return [];
  }

  return profiles
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const characterId =
        coerceString(entry.character_id ?? entry.characterId) ??
        coerceString(entry.character_name ?? entry.characterName);

      if (!characterId) {
        return null;
      }

      return {
        characterId,
        characterName: coerceString(entry.character_name ?? entry.characterName) ?? characterId,
        voiceName: coerceString(entry.voice_name ?? entry.voiceName),
        voiceProfile:
          coerceString(entry.voice_profile ?? entry.voiceProfile) ??
          coerceString(entry.voice_description ?? entry.voiceDescription),
        usageNotes: coerceString(entry.usage_notes ?? entry.usageNotes ?? entry.notes),
      } satisfies AudioVoiceProfileViewModel;
    })
    .filter((entry): entry is AudioVoiceProfileViewModel => Boolean(entry));
}

function parseMusicCues(record: UnknownRecord): AudioCueViewModel[] {
  const cues =
    (record.music_and_ambience_cues ?? record.musicAndAmbienceCues) ?? [];

  if (!Array.isArray(cues)) {
    return [];
  }

  return cues
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const cueName = coerceString(entry.cue_name ?? entry.cueName ?? entry.name);
      if (!cueName) {
        return null;
      }

      return {
        cueName,
        description: coerceString(entry.cue_description ?? entry.description),
        prompt: coerceString(entry.music_generation_prompt ?? entry.musicGenerationPrompt ?? entry.prompt),
        sceneletIds: coerceStringArray(
          entry.associated_scenelet_ids ?? entry.associatedSceneletIds ?? entry.scenelets
        ),
        audioFilePath: coerceString(entry.audio_file_path ?? entry.audioFilePath ?? entry.asset_path),
      } satisfies AudioCueViewModel;
    })
    .filter((entry): entry is AudioCueViewModel => Boolean(entry));
}

export function parseAudioDesignDocument(data: unknown): AudioDesignViewModel | null {
  const root = resolveAudioDocumentRoot(data);
  if (!root) {
    return null;
  }

  const sonicIdentity = parseSonicIdentity(root);
  const narratorProfile = parseNarratorProfile(root);
  const characterProfiles = parseVoiceProfiles(root);
  const musicCues = parseMusicCues(root);

  if (!sonicIdentity && !narratorProfile && characterProfiles.length === 0 && musicCues.length === 0) {
    return null;
  }

  return {
    sonicIdentity,
    narratorProfile,
    characterProfiles,
    musicCues,
    raw: root,
  };
}
