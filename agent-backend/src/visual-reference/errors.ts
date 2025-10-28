export class VisualReferenceTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisualReferenceTaskError';
  }
}
