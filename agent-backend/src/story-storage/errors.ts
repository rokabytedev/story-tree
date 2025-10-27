export class StoryTreeAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryTreeAssemblyError';
  }
}
