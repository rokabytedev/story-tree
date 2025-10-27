export class StoryboardTaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryboardTaskError';
  }
}
