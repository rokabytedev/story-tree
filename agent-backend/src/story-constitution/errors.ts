export class StoryConstitutionError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'StoryConstitutionError';
  }
}

export class StoryConstitutionParsingError extends StoryConstitutionError {
  readonly rawResponse: string;

  constructor(message: string, rawResponse: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'StoryConstitutionParsingError';
    this.rawResponse = rawResponse;
  }
}
