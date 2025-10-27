export class VisualDesignTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisualDesignTaskError';
  }
}
