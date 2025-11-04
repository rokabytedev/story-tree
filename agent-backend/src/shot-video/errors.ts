export class ShotVideoTaskError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, { cause });
    this.name = 'ShotVideoTaskError';
  }
}
