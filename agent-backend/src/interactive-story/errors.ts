export class InteractiveStoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InteractiveStoryError';
  }
}

export class InteractiveStoryParsingError extends InteractiveStoryError {
  public readonly rawResponse: string;

  constructor(message: string, rawResponse: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InteractiveStoryParsingError';
    this.rawResponse = rawResponse;
  }
}
