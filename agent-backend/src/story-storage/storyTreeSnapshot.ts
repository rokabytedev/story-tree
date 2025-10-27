import { StoryTreeAssemblyError } from './errors.js';
import { assembleStoryTreeSnapshot } from './storyTreeAssembler.js';
import type { StoryTreeSceneletSource, StoryTreeSnapshot } from './types.js';

export interface StoryTreeSceneletsRepository {
  listSceneletsByStory(storyId: string): Promise<StoryTreeSceneletSource[]>;
}

export interface StoryTreeSnapshotDependencies {
  sceneletsRepository: StoryTreeSceneletsRepository;
}

export async function loadStoryTreeSnapshot(
  storyId: string,
  dependencies: StoryTreeSnapshotDependencies
): Promise<StoryTreeSnapshot> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new StoryTreeAssemblyError('Story id must be provided to load the story tree snapshot.');
  }

  const { sceneletsRepository } = dependencies;
  if (!sceneletsRepository || typeof sceneletsRepository.listSceneletsByStory !== 'function') {
    throw new StoryTreeAssemblyError(
      'Story tree snapshot loader requires a scenelets repository dependency.'
    );
  }

  const rows = await sceneletsRepository.listSceneletsByStory(trimmedStoryId);
  return assembleStoryTreeSnapshot(rows);
}

export { assembleStoryTreeSnapshot };
