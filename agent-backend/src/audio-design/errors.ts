export class AudioDesignTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioDesignTaskError';
  }
}
