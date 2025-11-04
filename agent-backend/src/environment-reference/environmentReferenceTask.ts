import { createGeminiImageClient } from '../image-generation/geminiImageClient.js';
import { ImageStorageService } from '../image-generation/imageStorage.js';
import type { GeminiImageClient } from '../image-generation/types.js';
import { loadEnvironmentReferencePromptInstructions } from '../prompts/environmentReferencePrompt.js';
import { EnvironmentReferenceTaskError } from './errors.js';
import {
  buildEnvironmentReferencePrompt,
  extractEnvironmentDesign,
  extractGlobalAesthetic,
  parseVisualDesignDocument,
  type EnvironmentDesign,
  type VisualDesignDocument,
} from './promptBuilder.js';
import type {
  EnvironmentReferenceImageStorage,
  EnvironmentReferenceStoryRecord,
  EnvironmentReferenceTaskDependencies,
  EnvironmentReferenceTaskResult,
} from './types.js';

const ASPECT_RATIO = '16:9' as const;
const FILENAME = 'environment-reference.png' as const;

/**
 * Runs the environment reference image generation task for a story.
 * Generates structured prompts per environment and persists resulting image paths.
 */
export async function runEnvironmentReferenceTask(
  storyId: string,
  dependencies: EnvironmentReferenceTaskDependencies
): Promise<EnvironmentReferenceTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new EnvironmentReferenceTaskError(
      'Story id must be provided to run environment reference task.'
    );
  }

  const { storiesRepository, logger, verbose } = dependencies;
  if (!storiesRepository) {
    throw new EnvironmentReferenceTaskError(
      'Stories repository dependency is required for environment reference task.'
    );
  }

  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as EnvironmentReferenceStoryRecord | null;
  if (!story) {
    throw new EnvironmentReferenceTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const visualDesignDocument = parseVisualDesignDocument(story.visualDesignDocument);
  if (!visualDesignDocument) {
    throw new EnvironmentReferenceTaskError(
      `Story ${trimmedStoryId} must have a visual design document before generating environment reference images.`
    );
  }

  if (!visualDesignDocument.environment_designs || visualDesignDocument.environment_designs.length === 0) {
    throw new EnvironmentReferenceTaskError(
      `Visual design document for story ${trimmedStoryId} contains no environment designs.`
    );
  }

  const targetEnvironmentId = dependencies.targetEnvironmentId?.trim();
  const override = dependencies.override ?? false;
  const resume = dependencies.resume ?? false;

  const environmentsToProcess = resolveEnvironmentList(
    visualDesignDocument,
    targetEnvironmentId,
    trimmedStoryId
  );

  if (targetEnvironmentId && resume && logger?.debug) {
    logger.debug('Resume flag is ignored in single-environment mode', {
      storyId: trimmedStoryId,
      targetEnvironmentId,
    });
  }

  const geminiClient = resolveGeminiClient(dependencies);
  const imageStorage = resolveImageStorage(dependencies);
  const globalAesthetic = extractGlobalAesthetic(visualDesignDocument);
  const promptInstructions = await loadEnvironmentReferencePromptInstructions();

  let generatedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ environmentId: string; error: string }> = [];

  for (const environment of environmentsToProcess) {
    const environmentId = environment.environment_id;
    const environmentName = environment.environment_name;

    try {
      const hasExistingImage = hasExistingPath(environment.environment_reference_image_path);
      const skipForOverride = hasExistingImage && !override;
      const skipForResume = !targetEnvironmentId && resume && hasExistingImage;

      if (skipForOverride || skipForResume) {
        skippedCount += 1;
        if (verbose && logger?.debug) {
          logger.debug('Skipping environment with existing reference image', {
            storyId: trimmedStoryId,
            environmentId,
            existingPath: environment.environment_reference_image_path,
            reason: skipForOverride ? 'override-disabled' : 'resume-skip',
          });
        }
        continue;
      }

      const environmentDesign = targetEnvironmentId
        ? environment
        : extractEnvironmentDesign(visualDesignDocument, environmentId);

      const prompt = buildEnvironmentReferencePrompt(
        globalAesthetic,
        environmentDesign,
        promptInstructions
      );

      if (verbose && logger?.debug) {
        logger.debug('Generating environment reference image', {
          storyId: trimmedStoryId,
          environmentId,
          environmentName,
          aspectRatio: ASPECT_RATIO,
          timeoutMs: dependencies.timeoutMs,
          prompt,
        });
      }

      const generationStartedAt = Date.now();
      let imageData: Buffer;
      try {
        const result = await geminiClient.generateImage({
          userPrompt: prompt,
          aspectRatio: ASPECT_RATIO,
          timeoutMs: dependencies.timeoutMs,
          retry: dependencies.retry,
        });
        imageData = result.imageData;
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        errors.push({
          environmentId,
          error: `Failed to generate image: ${errorMessage}`,
        });
        logger?.debug?.(
          `Failed to generate environment reference for "${environmentId}": ${errorMessage}`,
          { cause: error }
        );
        continue;
      }

      if (verbose && logger?.debug) {
        logger.debug('Environment reference image generated', {
          storyId: trimmedStoryId,
          environmentId,
          durationMs: Date.now() - generationStartedAt,
          sizeBytes: imageData.length,
        });
      }

      const relativePath = buildImagePath(trimmedStoryId, environmentId);
      const { category, filename } = splitRelativePath(trimmedStoryId, relativePath);

      let savedPath: string;
      try {
        savedPath = await imageStorage.saveImage(imageData, trimmedStoryId, category, filename);
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        errors.push({
          environmentId,
          error: `Failed to save image: ${errorMessage}`,
        });
        logger?.debug?.(
          `Failed to save environment reference for "${environmentId}": ${errorMessage}`,
          { cause: error }
        );
        continue;
      }

      const persistedPath = normalizePersistedPath(savedPath);
      environment.environment_reference_image_path = persistedPath;

      if (verbose && logger?.debug) {
        logger.debug('Environment reference image saved', {
          storyId: trimmedStoryId,
          environmentId,
          savedPath,
          persistedPath,
        });
      }

      try {
        await storiesRepository.updateStoryArtifacts(trimmedStoryId, {
          visualDesignDocument,
        });
        generatedCount += 1;

        if (logger?.debug) {
          logger.debug('Environment reference persisted', {
            storyId: trimmedStoryId,
            environmentId,
            persistedPath,
          });
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        errors.push({
          environmentId,
          error: `Failed to update database (image saved at ${persistedPath}): ${errorMessage}`,
        });
        logger?.debug?.(
          `Failed to persist environment reference for "${environmentId}" (image saved at ${persistedPath}): ${errorMessage}`,
          { cause: error }
        );
        continue;
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      errors.push({
        environmentId,
        error: errorMessage,
      });
      logger?.debug?.(`Unexpected error processing environment "${environmentId}": ${errorMessage}`, {
        cause: error,
      });
      continue;
    }
  }

  if (logger?.debug) {
    logger.debug('Environment reference task complete', {
      storyId: trimmedStoryId,
      generatedCount,
      skippedCount,
      errorCount: errors.length,
    });
  }

  return {
    storyId: trimmedStoryId,
    generatedCount,
    skippedCount,
    errors,
  };
}

function resolveEnvironmentList(
  visualDesignDocument: VisualDesignDocument,
  targetEnvironmentId: string | undefined,
  storyId: string
): EnvironmentDesign[] {
  if (targetEnvironmentId) {
    const environment = extractEnvironmentDesign(visualDesignDocument, targetEnvironmentId);
    return [environment];
  }

  if (!visualDesignDocument.environment_designs || visualDesignDocument.environment_designs.length === 0) {
    throw new EnvironmentReferenceTaskError(
      `Visual design document for story ${storyId} contains no environment designs.`
    );
  }

  return visualDesignDocument.environment_designs;
}

function resolveGeminiClient(
  dependencies: EnvironmentReferenceTaskDependencies
): GeminiImageClient {
  if (dependencies.geminiImageClient) {
    return dependencies.geminiImageClient;
  }
  return createGeminiImageClient();
}

function resolveImageStorage(
  dependencies: EnvironmentReferenceTaskDependencies
): EnvironmentReferenceImageStorage {
  if (dependencies.imageStorage) {
    return dependencies.imageStorage;
  }
  return new ImageStorageService();
}

function hasExistingPath(pathValue: unknown): boolean {
  if (typeof pathValue !== 'string') {
    return false;
  }
  return pathValue.trim().length > 0;
}

function buildImagePath(storyId: string, environmentId: string): string {
  return `${storyId}/visuals/environments/${environmentId}/${FILENAME}`;
}

function splitRelativePath(storyId: string, fullPath: string): { category: string; filename: string } {
  const prefix = `${storyId}/`;
  if (!fullPath.startsWith(prefix)) {
    throw new EnvironmentReferenceTaskError(
      `Generated image path must start with the story id. Received: ${fullPath}`
    );
  }

  const remainder = fullPath.slice(prefix.length);
  const lastSlashIndex = remainder.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    throw new EnvironmentReferenceTaskError(
      `Generated image path must include a category directory. Received: ${fullPath}`
    );
  }

  const category = remainder.slice(0, lastSlashIndex);
  const filename = remainder.slice(lastSlashIndex + 1);

  if (!category || !filename) {
    throw new EnvironmentReferenceTaskError(
      `Generated image path is missing category or filename. Received: ${fullPath}`
    );
  }

  return { category, filename };
}

function normalizePersistedPath(savedPath: string): string {
  const trimmed = savedPath?.trim?.() ?? '';
  if (!trimmed) {
    throw new EnvironmentReferenceTaskError('Image storage returned empty path.');
  }

  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  if (withoutLeadingSlash.startsWith('generated/')) {
    return withoutLeadingSlash;
  }

  return `generated/${withoutLeadingSlash}`;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}
