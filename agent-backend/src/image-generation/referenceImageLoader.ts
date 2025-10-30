import { readFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import type { ReferenceImage } from './types.js';

export class ReferenceImageLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceImageLoadError';
  }
}

const MIME_TYPE_MAP: Record<string, ReferenceImage['mimeType']> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * Loads reference images from file paths on disk.
 * Reads files, validates MIME types, and returns ReferenceImage objects
 * ready for use with the Gemini image client.
 *
 * @param paths - Array of file paths to load
 * @returns Array of ReferenceImage objects
 * @throws ReferenceImageLoadError if any file cannot be read or has unsupported format
 */
export function loadReferenceImagesFromPaths(paths: string[]): ReferenceImage[] {
  const images: ReferenceImage[] = [];

  for (const path of paths) {
    if (!existsSync(path)) {
      throw new ReferenceImageLoadError(`Reference image file not found: ${path}`);
    }

    const ext = extname(path).toLowerCase();
    const mimeType = MIME_TYPE_MAP[ext];

    if (!mimeType) {
      throw new ReferenceImageLoadError(
        `Unsupported reference image format '${ext}' for file: ${path}. Supported formats: .png, .jpg, .jpeg`
      );
    }

    try {
      const data = readFileSync(path);
      if (data.length === 0) {
        throw new ReferenceImageLoadError(`Reference image file is empty: ${path}`);
      }

      images.push({
        data,
        mimeType,
        name: path,
      });
    } catch (error) {
      if (error instanceof ReferenceImageLoadError) {
        throw error;
      }
      throw new ReferenceImageLoadError(
        `Failed to read reference image file '${path}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return images;
}
