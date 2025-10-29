export class VisualReferenceImageTaskError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'VisualReferenceImageTaskError';
  }
}

