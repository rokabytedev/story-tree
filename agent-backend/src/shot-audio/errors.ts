export class ShotAudioTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShotAudioTaskError';
  }
}

export class ShotAudioValidationError extends ShotAudioTaskError {
  constructor(message: string) {
    super(message);
    this.name = 'ShotAudioValidationError';
  }
}

export class UnsupportedSpeakerCountError extends ShotAudioValidationError {
  public readonly speakerCount: number;

  constructor(speakerCount: number, message?: string) {
    super(message ?? `Shot audio generation supports up to two speakers but received ${speakerCount}.`);
    this.name = 'UnsupportedSpeakerCountError';
    this.speakerCount = speakerCount;
  }
}
