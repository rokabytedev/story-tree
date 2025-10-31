import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ShotImageTaskError } from './errors.js';
import { normalizeNameForPath } from '../image-generation/normalizeNameForPath.js';

export interface ReferenceImageLoaderOptions {
  baseDir?: string;
}

export interface ReferenceImageLoader {
  loadCharacterReferences(
    storyId: string,
    characterNames: string[],
    maxImages: number
  ): Promise<Map<string, string[]>>;
}

export function createReferenceImageLoader(
  options: ReferenceImageLoaderOptions = {}
): ReferenceImageLoader {
  const baseDir = options.baseDir ?? path.join(process.cwd(), 'apps/story-tree-ui/public/generated');

  return {
    async loadCharacterReferences(
      storyId: string,
      characterNames: string[],
      maxImages: number
    ): Promise<Map<string, string[]>> {
      const references = new Map<string, string[]>();

      for (const characterName of characterNames) {
        const normalizedName = normalizeNameForPath(characterName);
        const characterDir = path.join(baseDir, storyId, 'visuals/characters', normalizedName);

        try {
          const entries = await fs.readdir(characterDir, { withFileTypes: true });
          const imagePaths = entries
            .filter((entry) => entry.isFile() && /\.(png|jpg|jpeg)$/i.test(entry.name))
            .map((entry) => path.join(characterDir, entry.name))
            .slice(0, maxImages);

          if (imagePaths.length === 0) {
            throw new ShotImageTaskError(
              `No reference images found for character "${characterName}" in ${characterDir}`
            );
          }

          references.set(characterName, imagePaths);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new ShotImageTaskError(
              `Reference image directory not found for character "${characterName}": ${characterDir}`,
              error as Error
            );
          }
          throw error;
        }
      }

      return references;
    },
  };
}
