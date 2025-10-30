import { createGeminiImageClient } from '../image-generation/geminiImageClient.js';
import { ImageStorageService } from '../image-generation/imageStorage.js';
import { CharacterModelSheetTaskError } from './errors.js';
import {
  buildModelSheetPrompt,
  extractCharacterDesign,
  extractGlobalAesthetic,
  type VisualDesignDocument,
} from './promptBuilder.js';
import type {
  CharacterModelSheetImageStorage,
  CharacterModelSheetStoryRecord,
  CharacterModelSheetTaskDependencies,
  CharacterModelSheetTaskResult,
} from './types.js';
import type { GeminiImageClient } from '../image-generation/types.js';

const ASPECT_RATIO = '1:1' as const;

/**
 * Runs the Character Model Sheet generation task
 * Generates structured character model sheet reference images using visual design data
 */
export async function runCharacterModelSheetTask(
  storyId: string,
  dependencies: CharacterModelSheetTaskDependencies
): Promise<CharacterModelSheetTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new CharacterModelSheetTaskError('Story id must be provided to run character model sheet task.');
  }

  const { storiesRepository, logger, verbose } = dependencies;
  if (!storiesRepository) {
    throw new CharacterModelSheetTaskError(
      'Stories repository dependency is required for character model sheet task.'
    );
  }

  // Load story and validate
  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as CharacterModelSheetStoryRecord | null;
  if (!story) {
    throw new CharacterModelSheetTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const visualDesignDoc = parseVisualDesignDocument(story.visualDesignDocument);
  if (!visualDesignDoc) {
    throw new CharacterModelSheetTaskError(
      `Story ${trimmedStoryId} must have a visual design document before generating character model sheets.`
    );
  }

  if (!visualDesignDoc.character_designs || visualDesignDoc.character_designs.length === 0) {
    throw new CharacterModelSheetTaskError(
      `Visual design document for story ${trimmedStoryId} contains no character designs.`
    );
  }

  // Determine which characters to process
  const targetCharacterId = dependencies.targetCharacterId?.trim();
  const override = dependencies.override ?? false;
  const resume = dependencies.resume ?? false;

  let charactersToProcess = visualDesignDoc.character_designs;

  if (targetCharacterId) {
    // Single character mode
    const targetCharacter = visualDesignDoc.character_designs.find(
      (design) => design.character_id === targetCharacterId
    );
    if (!targetCharacter) {
      const availableIds = visualDesignDoc.character_designs
        .map((d) => d.character_id)
        .join(', ');
      throw new CharacterModelSheetTaskError(
        `Character with id "${targetCharacterId}" not found. Available: ${availableIds}`
      );
    }
    charactersToProcess = [targetCharacter];

    // Warn if resume flag is used in single-character mode (it's ignored)
    if (resume && logger?.debug) {
      logger.debug('Resume flag is ignored in single-character mode', { targetCharacterId });
    }
  }

  // Resolve dependencies
  const geminiClient = resolveGeminiClient(dependencies);
  const imageStorage = resolveImageStorage(dependencies);

  // Extract global aesthetic once (used for all characters)
  const globalAesthetic = extractGlobalAesthetic(visualDesignDoc);

  // Process each character
  let generatedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ characterId: string; error: string }> = [];

  for (const character of charactersToProcess) {
    const characterId = character.character_id;

    try {
      // Check if model sheet already exists
      const existingPath = character.character_model_sheet_image_path;
      const hasExistingImage = typeof existingPath === 'string' && existingPath.trim().length > 0;

      if (hasExistingImage && !override) {
        if (verbose && logger?.debug) {
          logger.debug('Skipping character with existing model sheet', {
            characterId,
            existingPath,
          });
        }
        skippedCount += 1;
        continue;
      }

      // Extract character design
      const characterDesign = extractCharacterDesign(visualDesignDoc, characterId);

      // Build structured prompt
      const prompt = buildModelSheetPrompt(globalAesthetic, characterDesign);

      if (verbose && logger?.debug) {
        logger.debug('Generating character model sheet', {
          storyId: trimmedStoryId,
          characterId,
          aspectRatio: ASPECT_RATIO,
          timeoutMs: dependencies.timeoutMs,
          prompt,
        });
      }

      // Generate image
      const startTime = Date.now();
      let imageData: Buffer;
      try {
        const result = await geminiClient.generateImage({
          userPrompt: prompt,
          aspectRatio: ASPECT_RATIO,
          timeoutMs: dependencies.timeoutMs,
          retry: dependencies.retry,
        });
        imageData = result.imageData;

        if (verbose && logger?.debug) {
          const durationMs = Date.now() - startTime;
          logger.debug('Image generated', {
            characterId,
            sizeBytes: imageData.length,
            durationMs,
          });
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        errors.push({
          characterId,
          error: `Failed to generate image: ${errorMessage}`,
        });
        logger?.debug?.(`Failed to generate model sheet for character "${characterId}": ${errorMessage}`, {
          cause: error,
        });
        continue; // Continue processing other characters
      }

      // Save image to storage
      const imagePath = `${trimmedStoryId}/visuals/characters/${characterId}/character-model-sheet.png`;
      const { category, filename } = splitRelativePath(trimmedStoryId, imagePath);

      let savedPath: string;
      try {
        savedPath = await imageStorage.saveImage(imageData, trimmedStoryId, category, filename);

        if (verbose && logger?.debug) {
          logger.debug('Image saved', {
            characterId,
            path: savedPath,
          });
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        errors.push({
          characterId,
          error: `Failed to save image: ${errorMessage}`,
        });
        logger?.debug?.(`Failed to save model sheet for character "${characterId}": ${errorMessage}`, {
          cause: error,
        });
        continue; // Continue processing other characters (don't corrupt database)
      }

      // Update character design with image path in the visual design document
      character.character_model_sheet_image_path = savedPath;

      // Persist to database immediately (per-character, not batched)
      try {
        await storiesRepository.updateStoryArtifacts(trimmedStoryId, {
          visualDesignDocument: visualDesignDoc,
        });
        generatedCount += 1;

        if (verbose && logger?.debug) {
          logger.debug('Database updated', {
            characterId,
            path: savedPath,
          });
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        errors.push({
          characterId,
          error: `Failed to update database (image was saved successfully at ${savedPath}): ${errorMessage}`,
        });
        logger?.debug?.(
          `Failed to update database for character "${characterId}" (image saved at ${savedPath}): ${errorMessage}`,
          { cause: error }
        );
        // Note: Image was generated successfully, but database update failed
        // This is a partial success - the image exists but the path is not recorded
        continue;
      }
    } catch (error) {
      // Catch any unexpected errors during character processing
      const errorMessage = extractErrorMessage(error);
      errors.push({
        characterId,
        error: errorMessage,
      });
      logger?.debug?.(`Unexpected error processing character "${characterId}": ${errorMessage}`, {
        cause: error,
      });
      continue;
    }
  }

  // Log summary
  if (logger?.debug) {
    logger.debug('Character model sheet generation complete', {
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

function resolveGeminiClient(dependencies: CharacterModelSheetTaskDependencies): GeminiImageClient {
  if (dependencies.geminiImageClient) {
    return dependencies.geminiImageClient;
  }
  return createGeminiImageClient();
}

function resolveImageStorage(dependencies: CharacterModelSheetTaskDependencies): CharacterModelSheetImageStorage {
  if (dependencies.imageStorage) {
    return dependencies.imageStorage;
  }
  return new ImageStorageService();
}

function splitRelativePath(storyId: string, fullPath: string): { category: string; filename: string } {
  const prefix = `${storyId}/`;
  if (!fullPath.startsWith(prefix)) {
    throw new CharacterModelSheetTaskError(
      `Generated image path must start with the story id. Received: ${fullPath}`
    );
  }

  const remainder = fullPath.slice(prefix.length);
  const lastSlashIndex = remainder.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    throw new CharacterModelSheetTaskError(
      `Generated image path must include a category directory. Received: ${fullPath}`
    );
  }

  const category = remainder.slice(0, lastSlashIndex);
  const filename = remainder.slice(lastSlashIndex + 1);

  if (!category || !filename) {
    throw new CharacterModelSheetTaskError(`Generated image path is missing category or filename. Received: ${fullPath}`);
  }

  return { category, filename };
}

function parseVisualDesignDocument(raw: unknown): VisualDesignDocument | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  let parsed: unknown;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new CharacterModelSheetTaskError(
        'visual_design_document must be valid JSON when provided as a string.'
      );
    }
  } else {
    parsed = raw;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CharacterModelSheetTaskError('visual_design_document must be an object.');
  }

  return parsed as VisualDesignDocument;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
