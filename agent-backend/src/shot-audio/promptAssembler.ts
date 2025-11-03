import { ShotAudioValidationError } from './errors.js';
import type { PromptAssemblerDependencies, ShotAudioPrompt } from './types.js';
import type {
  AudioDesignDocument,
  AudioVoiceProfile,
  NarratorVoiceProfile,
} from '../audio-design/types.js';
import type { ShotProductionStoryboardEntry } from '../shot-production/types.js';

export function assembleShotAudioPrompt({
  shot,
  audioDesign,
  analysis,
}: PromptAssemblerDependencies): ShotAudioPrompt {
  if (!shot) {
    throw new ShotAudioValidationError('Shot record is required to assemble audio prompt.');
  }

  if (!audioDesign) {
    throw new ShotAudioValidationError('Audio design document is required to assemble audio prompt.');
  }

  const storyboard = extractStoryboard(shot.storyboardPayload);
  const audioEntries = storyboard.audioAndNarrative;

  if (!Array.isArray(audioEntries) || audioEntries.length === 0) {
    throw new ShotAudioValidationError(
      'Shot storyboard payload is missing audioAndNarrative entries required for audio generation.'
    );
  }

  const filteredProfiles = filterVoiceProfiles(analysis.speakers, audioDesign.character_voice_profiles);
  const narratorProfile = audioDesign.narrator_voice_profile as NarratorVoiceProfile | undefined;

  const includeNarrator = analysis.speakers.includes('narrator');
  if (includeNarrator) {
    if (!narratorProfile) {
      throw new ShotAudioValidationError(
        'Shot references narrator but audio design document is missing narrator_voice_profile.'
      );
    }

    if (!narratorProfile.voice_name?.trim()) {
      throw new ShotAudioValidationError('narrator_voice_profile.voice_name must be provided.');
    }
  }

  const promptSegments: string[] = [];

  if (includeNarrator && narratorProfile) {
    promptSegments.push(
      JSON.stringify({
        narrator_voice_profile: narratorProfile,
      })
    );
  }

  promptSegments.push(
    JSON.stringify({
      character_voice_profiles: filteredProfiles,
    })
  );

  promptSegments.push(
    JSON.stringify({
      audio_and_narrative: audioEntries,
    })
  );

  const speakers = buildSpeakerConfigs(analysis.speakers, filteredProfiles, narratorProfile);

  return {
    prompt: promptSegments.join('\n'),
    speakers,
    mode: analysis.mode,
  };
}

const BRANCH_DELIVERY_CUE =
  'In a curious, welcoming narrator tone, invite the listener to explore their options.';

export function buildBranchAudioScript(choicePrompt: string, choiceLabels: string[]): string {
  const prompt = choicePrompt?.trim();
  if (!prompt) {
    throw new ShotAudioValidationError('Branch prompt must be provided to build narration script.');
  }

  const normalizedChoices = choiceLabels
    .map((label) => label?.trim())
    .filter((label): label is string => Boolean(label));

  if (normalizedChoices.length < 2) {
    throw new ShotAudioValidationError('At least two branch choice labels are required.');
  }

  const sentences: string[] = [];
  sentences.push(ensureSentenceEnding(prompt));

  if (normalizedChoices.length === 2) {
    sentences.push(`${normalizedChoices[0]}.`);
    sentences.push(`Or ${normalizedChoices[1]}.`);
  } else {
    const finalLabel = normalizedChoices[normalizedChoices.length - 1]!;
    const preceding = normalizedChoices.slice(0, -1).join(', ');
    sentences.push(`${preceding}, or ${finalLabel}.`);
  }

  return sentences.join(' ');
}

export function assembleBranchAudioPrompt(
  audioDesign: AudioDesignDocument,
  script: string
): ShotAudioPrompt {
  if (!audioDesign) {
    throw new ShotAudioValidationError('Audio design document is required for branch narration.');
  }

  const narratorProfile = audioDesign.narrator_voice_profile as NarratorVoiceProfile | undefined;
  if (!narratorProfile) {
    throw new ShotAudioValidationError(
      'Branch narration requires narrator_voice_profile in the audio design.'
    );
  }

  const voiceName = narratorProfile.voice_name?.trim();
  if (!voiceName) {
    throw new ShotAudioValidationError(
      'narrator_voice_profile.voice_name must be provided for branch narration.'
    );
  }

  const trimmedScript = script?.trim();
  if (!trimmedScript) {
    throw new ShotAudioValidationError('Branch narration script must be provided.');
  }

  const promptSegments = [
    JSON.stringify({
      narrator_voice_profile: narratorProfile,
    }),
    JSON.stringify({
      branch_prompt_script: `${BRANCH_DELIVERY_CUE} ${trimmedScript}`.trim(),
    }),
  ];

  return {
    prompt: promptSegments.join('\n'),
    speakers: [
      {
        speaker: 'narrator',
        voiceName,
      },
    ],
    mode: 'single',
  };
}

function extractStoryboard(payload: unknown): ShotProductionStoryboardEntry {
  if (!payload || typeof payload !== 'object') {
    throw new ShotAudioValidationError('Shot storyboard payload must be an object.');
  }

  return payload as ShotProductionStoryboardEntry;
}

function filterVoiceProfiles(
  speakers: string[],
  profiles: AudioVoiceProfile[] | undefined
): AudioVoiceProfile[] {
  const relevantSpeakers = speakers.filter((speaker) => speaker !== 'narrator');

  if (relevantSpeakers.length === 0) {
    return [];
  }

  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new ShotAudioValidationError('Audio design document is missing character_voice_profiles.');
  }

  const lookup = new Map<string, AudioVoiceProfile>();
  for (const profile of profiles) {
    const characterId = profile?.character_id?.trim();
    if (characterId) {
      lookup.set(characterId, profile);
    }
  }

  const filtered: AudioVoiceProfile[] = [];
  const missing: string[] = [];

  for (const speaker of relevantSpeakers) {
    const profile = lookup.get(speaker);
    if (!profile) {
      missing.push(speaker);
      continue;
    }

    if (!profile.voice_name?.trim()) {
      throw new ShotAudioValidationError(
        `Audio design voice profile for ${speaker} is missing voice_name.`
      );
    }

    filtered.push(profile);
  }

  if (missing.length > 0) {
    throw new ShotAudioValidationError(
      `Audio design document is missing voice profiles for: ${missing.join(', ')}`
    );
  }

  return filtered;
}

function buildSpeakerConfigs(
  speakers: string[],
  characterProfiles: AudioVoiceProfile[],
  narratorProfile?: NarratorVoiceProfile
) {
  const characterLookup = new Map<string, AudioVoiceProfile>();
  for (const profile of characterProfiles) {
    if (profile.character_id) {
      characterLookup.set(profile.character_id, profile);
    }
  }

  return speakers.map((speaker) => {
    if (speaker === 'narrator') {
      if (!narratorProfile) {
        throw new ShotAudioValidationError('Narrator voice profile is required but missing.');
      }
      return {
        speaker,
        voiceName: narratorProfile.voice_name,
      } as const;
    }

    const profile = characterLookup.get(speaker);
    if (!profile) {
      throw new ShotAudioValidationError(
        `Audio design document is missing a voice profile for character ${speaker}.`
      );
    }

    return {
      speaker,
      voiceName: profile.voice_name,
    } as const;
  });
}

function ensureSentenceEnding(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/[.!?"]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
}
