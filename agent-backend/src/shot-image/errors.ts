export class ShotImageTaskError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = 'ShotImageTaskError';
  }
}

export class CharacterReferenceMissingError extends ShotImageTaskError {
  constructor(characterName: string, storyId: string) {
    super(`Character reference for "${characterName}" not found in story ${storyId}`);
    this.name = 'CharacterReferenceMissingError';
  }
}
