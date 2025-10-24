export interface StoryConstitution {
  proposedStoryTitle: string;
  storyConstitutionMarkdown: string;
}

export interface StoryConstitutionOptions {
  geminiClient?: import('../gemini/types.js').GeminiJsonClient;
  promptLoader?: () => Promise<string>;
}
