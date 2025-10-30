import * as fsPromises from 'node:fs/promises';
import path from 'node:path';

type ImageStorageCategory = 'visuals' | 'shots' | string;

interface ImageStorageServiceOptions {
  publicGeneratedRoot?: string;
}

interface ImageStorageServiceDependencies {
  fileSystem?: Pick<typeof fsPromises, 'mkdir' | 'writeFile'>;
}

export class ImageStorageService {
  private readonly publicGeneratedRoot: string;
  private readonly fileSystem: Pick<typeof fsPromises, 'mkdir' | 'writeFile'>;

  constructor(options: ImageStorageServiceOptions = {}, dependencies: ImageStorageServiceDependencies = {}) {
    this.publicGeneratedRoot =
      options.publicGeneratedRoot ?? path.resolve(process.cwd(), 'apps/story-tree-ui/public/generated');
    this.fileSystem = dependencies.fileSystem ?? fsPromises;
  }

  async saveImage(buffer: Buffer, storyId: string, category: ImageStorageCategory, filename: string): Promise<string> {
    ImageStorageService.assertSafeSegment(storyId, 'Story ID');
    ImageStorageService.assertSafeCategory(category);
    ImageStorageService.assertSafeFilename(filename);

    const directoryPath = path.join(this.publicGeneratedRoot, storyId, category);

    try {
      await this.fileSystem.mkdir(directoryPath, { recursive: true });
    } catch (error) {
      throw ImageStorageService.wrapFsError(error, `prepare image directory ${directoryPath}`);
    }

    const absoluteFilePath = path.join(directoryPath, filename);

    try {
      await this.fileSystem.writeFile(absoluteFilePath, buffer);
    } catch (error) {
      throw ImageStorageService.wrapFsError(error, `save image to ${absoluteFilePath}`);
    }

    return path.posix.join(storyId, category, filename);
  }

  private static assertSafeSegment(value: string, label: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error(`${label} must be provided.`);
    }
    if (path.isAbsolute(value) || value.includes('/') || value.includes('\\') || value.includes('..')) {
      throw new Error(`${label} contains invalid path characters.`);
    }
  }

  private static assertSafeCategory(category: string): void {
    if (!category || category.trim().length === 0) {
      throw new Error('Category must be provided.');
    }

    if (path.isAbsolute(category) || category.includes('..') || category.includes('\\')) {
      throw new Error('Category contains invalid path characters.');
    }

    const segments = category.split('/');
    if (segments.some((segment) => !segment || segment.trim().length === 0)) {
      throw new Error('Category contains invalid segments.');
    }
  }

  private static assertSafeFilename(filename: string): void {
    if (!filename || filename.trim().length === 0) {
      throw new Error('Filename must be provided.');
    }
    if (filename !== filename.trim()) {
      throw new Error('Filename must not include leading or trailing whitespace.');
    }
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new Error('Filename contains invalid path characters.');
    }
  }

  private static wrapFsError(error: unknown, action: string): Error {
    if (ImageStorageService.isNodeError(error) && (error.code === 'EACCES' || error.code === 'ENOSPC')) {
      return new Error(`Unable to ${action}: ${error.message}`, { cause: error });
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  private static isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
  }
}
