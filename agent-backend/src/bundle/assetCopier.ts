import path from 'node:path';
import * as fsPromises from 'node:fs/promises';

import type { ShotRecord } from '../shot-production/types.js';
import { SKIPPED_AUDIO_PLACEHOLDER } from '../shot-audio/constants.js';
import { buildAudioRelativePath, buildImageRelativePath, BundleAssemblyError } from './bundleAssembler.js';
import type {
  AssetCopierOptions,
  AssetManifest,
  BundleLogger,
  FileSystemAdapter,
  SceneletShotAssetMap,
  ShotAssetPaths,
} from './types.js';

const DEFAULT_GENERATED_ROOT = path.resolve(process.cwd(), 'apps/story-tree-ui/public/generated');

/**
 * Copies shot images and audio files into the bundle output directory and returns a manifest of
 * the successfully copied assets.
 */
export async function copyAssets(
  storyId: string,
  shotsByScenelet: Record<string, ShotRecord[]>,
  storyOutputDir: string,
  options: AssetCopierOptions = {}
): Promise<AssetManifest> {
  const normalizedStoryId = storyId?.trim?.() ?? '';
  if (!normalizedStoryId) {
    throw new BundleAssemblyError('Story id must be provided to copy bundle assets.');
  }

  const trimmedOutputPath = storyOutputDir?.toString?.().trim?.() ?? '';
  if (!trimmedOutputPath) {
    throw new BundleAssemblyError('Output directory must be provided for asset copying.');
  }

  const logger = options.logger;
  const fsAdapter: FileSystemAdapter = options.fileSystem ?? fsPromises;
  const generatedRoot = options.generatedAssetsRoot
    ? path.resolve(options.generatedAssetsRoot)
    : DEFAULT_GENERATED_ROOT;

  const normalizedOutputDir = path.resolve(trimmedOutputPath, normalizedStoryId);
  await ensureDirectory(fsAdapter, normalizedOutputDir);

  const assetsRoot = path.join(normalizedOutputDir, 'assets', 'shots');
  await ensureDirectory(fsAdapter, assetsRoot);

  const manifest: AssetManifest = new Map();

  for (const [sceneletId, shots] of Object.entries(shotsByScenelet)) {
    if (!Array.isArray(shots) || shots.length === 0) {
      continue;
    }

    if (!sceneletId || !sceneletId.trim()) {
      logger?.warn?.('Skipping scenelet with invalid id during asset copy', {
        storyId: normalizedStoryId,
      });
      continue;
    }

    const targetSceneletDir = path.join(assetsRoot, sceneletId);
    let preparedSceneletDir = false;
    const shotAssets: SceneletShotAssetMap = new Map();

    for (const shot of shots) {
      if (!Number.isInteger(shot?.shotIndex) || shot.shotIndex <= 0) {
        continue;
      }

      let imagePath: string | null = null;
      let audioPath: string | null = null;

      const imageSource = resolveSourcePath(generatedRoot, shot.keyFrameImagePath);
      if (imageSource) {
        const exists = await fileExists(fsAdapter, imageSource);
        if (!exists) {
          logger?.warn?.('Missing shot image for bundle', {
            storyId: normalizedStoryId,
            sceneletId,
            shotIndex: shot.shotIndex,
            sourcePath: shot.keyFrameImagePath,
          });
        } else {
          if (!preparedSceneletDir) {
            await ensureDirectory(fsAdapter, targetSceneletDir);
            preparedSceneletDir = true;
          }
          imagePath = buildImageRelativePath(sceneletId, shot.shotIndex);
          const targetImage = path.join(normalizedOutputDir, imagePath);
          await fsAdapter.copyFile(imageSource, targetImage);
        }
      }

      const audioSource = resolveSourcePath(generatedRoot, shot.audioFilePath);
      if (audioSource) {
        const exists = await fileExists(fsAdapter, audioSource);
        if (!exists) {
          logger?.warn?.('Missing shot audio for bundle', {
            storyId: normalizedStoryId,
            sceneletId,
            shotIndex: shot.shotIndex,
            sourcePath: shot.audioFilePath,
          });
        } else {
          if (!preparedSceneletDir) {
            await ensureDirectory(fsAdapter, targetSceneletDir);
            preparedSceneletDir = true;
          }
          audioPath = buildAudioRelativePath(sceneletId, shot.shotIndex);
          const targetAudio = path.join(normalizedOutputDir, audioPath);
          await fsAdapter.copyFile(audioSource, targetAudio);
        }
      }

      if (imagePath || audioPath) {
        if (!preparedSceneletDir) {
          await ensureDirectory(fsAdapter, targetSceneletDir);
          preparedSceneletDir = true;
        }

        const entry: ShotAssetPaths = {
          imagePath,
          audioPath,
        };

        shotAssets.set(shot.shotIndex, entry);
      }
    }

    if (shotAssets.size > 0) {
      manifest.set(sceneletId, shotAssets);
    }
  }

  return manifest;
}

/** Copies the standalone player HTML template into the story bundle output directory. */
export async function copyPlayerTemplate(templatePath: string, storyOutputDir: string): Promise<void> {
  const resolvedTemplatePath = path.resolve(templatePath);
  if (!resolvedTemplatePath.trim()) {
    throw new BundleAssemblyError('Player template path must be provided.');
  }

  const fsAdapter: FileSystemAdapter = fsPromises;

  try {
    await fsAdapter.access(resolvedTemplatePath);
  } catch (error) {
    throw new BundleAssemblyError(
      `Player template not found at ${resolvedTemplatePath}: ${getErrorMessage(error)}`
    );
  }

  await ensureDirectory(fsAdapter, storyOutputDir);
  const targetPath = path.join(storyOutputDir, 'player.html');

  try {
    await fsAdapter.copyFile(resolvedTemplatePath, targetPath);
  } catch (error) {
    throw new BundleAssemblyError(
      `Failed to copy player template to ${targetPath}: ${getErrorMessage(error)}`
    );
  }
}

async function ensureDirectory(fsAdapter: FileSystemAdapter, directoryPath: string): Promise<void> {
  try {
    await fsAdapter.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    throw new BundleAssemblyError(`Failed to create directory ${directoryPath}: ${getErrorMessage(error)}`);
  }
}

async function fileExists(fsAdapter: FileSystemAdapter, filePath: string): Promise<boolean> {
  try {
    await fsAdapter.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveSourcePath(root: string, relativePath?: string | null): string | null {
  if (!relativePath) {
    return null;
  }

  const trimmed = relativePath.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toUpperCase() === SKIPPED_AUDIO_PLACEHOLDER) {
    return null;
  }

  const withoutGeneratedPrefix = trimmed.startsWith('generated/')
    ? trimmed.slice('generated/'.length)
    : trimmed;

  const normalized = path.normalize(withoutGeneratedPrefix);
  if (normalized.startsWith('..')) {
    return null;
  }

  return path.join(root, normalized);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
