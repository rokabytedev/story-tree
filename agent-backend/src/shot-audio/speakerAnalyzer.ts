import { ShotAudioValidationError, UnsupportedSpeakerCountError } from './errors.js';
import type { SpeakerAnalysis } from './types.js';
import type { AudioNarrativeEntry } from '../shot-production/types.js';

export function analyzeSpeakers(entries: AudioNarrativeEntry[]): SpeakerAnalysis {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ShotAudioValidationError('Shot storyboard payload is missing audioAndNarrative entries.');
  }

  const speakers: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const speaker = entry?.source?.trim();
    if (!speaker) {
      throw new ShotAudioValidationError('audioAndNarrative entries must include a source value.');
    }

    if (!seen.has(speaker)) {
      seen.add(speaker);
      speakers.push(speaker);
    }
  }

  if (speakers.length === 0) {
    throw new ShotAudioValidationError('audioAndNarrative entries did not include any valid speakers.');
  }

  if (speakers.length > 2) {
    throw new UnsupportedSpeakerCountError(speakers.length);
  }

  return {
    mode: speakers.length === 1 ? 'single' : 'multi',
    speakers,
  };
}
