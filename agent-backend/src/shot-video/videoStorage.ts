import path from 'node:path';

import { ImageStorageService } from '../image-generation/imageStorage.js';
import type { VideoStorage } from './types.js';

export interface FileSystemVideoStorageOptions {
  generatedRoot?: string;
}

const DEFAULT_GENERATED_ROOT = path.resolve(
  process.cwd(),
  'apps/story-tree-ui/public/generated'
);

export function createFileSystemVideoStorage(
  options: FileSystemVideoStorageOptions = {}
): VideoStorage {
  const generatedRoot = options.generatedRoot
    ? path.resolve(options.generatedRoot)
    : DEFAULT_GENERATED_ROOT;

  const storage = new ImageStorageService({ publicGeneratedRoot: generatedRoot });

  return {
    async saveVideo(videoData, storyId, category, filename) {
      const relative = await storage.saveImage(videoData, storyId, category, filename);
      return path.posix.join('generated', relative);
    },
  };
}
