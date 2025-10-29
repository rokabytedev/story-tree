import { createGeminiImageClient } from '../image-generation/geminiImageClient.js';
import { ImageStorageService } from '../image-generation/imageStorage.js';
import { buildVisualReferencePath } from '../storage/imagePathHelpers.js';
import { VisualReferenceImageTaskError } from './errors.js';
import type {
  VisualReferenceCharacterPlate,
  VisualReferenceCharacterSheet,
  VisualReferenceEnvironmentEntry,
  VisualReferenceEnvironmentKeyframe,
  VisualReferenceImageStoryRecord,
  VisualReferenceImageTaskDependencies,
  VisualReferenceImageTaskResult,
  VisualReferenceImageStorage,
  VisualReferencePackage,
} from './types.js';
import type { GeminiImageClient, ImageAspectRatio } from '../image-generation/types.js';

const DEFAULT_ASPECT_RATIO: ImageAspectRatio = '16:9';

export async function runVisualReferenceImageTask(
  storyId: string,
  dependencies: VisualReferenceImageTaskDependencies
): Promise<VisualReferenceImageTaskResult> {
  const trimmedStoryId = storyId?.trim() ?? '';
  if (!trimmedStoryId) {
    throw new VisualReferenceImageTaskError('Story id must be provided to run visual reference image task.');
  }

  const { storiesRepository, logger } = dependencies;
  if (!storiesRepository) {
    throw new VisualReferenceImageTaskError(
      'Stories repository dependency is required for visual reference image task.'
    );
  }

  const story = (await storiesRepository.getStoryById(trimmedStoryId)) as VisualReferenceImageStoryRecord | null;
  if (!story) {
    throw new VisualReferenceImageTaskError(`Story ${trimmedStoryId} not found.`);
  }

  const packageClone = cloneVisualReferencePackage(story.visualReferencePackage);
  if (!packageClone) {
    throw new VisualReferenceImageTaskError(
      `Story ${trimmedStoryId} must have a visual reference package before generating images.`
    );
  }

  const geminiClient = resolveGeminiClient(dependencies);
  const imageStorage = resolveImageStorage(dependencies);
  const characterAspectRatio = dependencies.characterAspectRatio ?? DEFAULT_ASPECT_RATIO;
  const environmentAspectRatio = dependencies.environmentAspectRatio ?? DEFAULT_ASPECT_RATIO;

  const targetCharacterId = dependencies.targetCharacterId?.trim();
  const targetEnvironmentId = dependencies.targetEnvironmentId?.trim();
  const targetIndex = dependencies.targetIndex;

  // Validate target exists if specified
  if (targetCharacterId) {
    const found = packageClone.character_model_sheets.find(
      (sheet) => sheet.character_id === targetCharacterId
    );
    if (!found) {
      throw new VisualReferenceImageTaskError(
        `Target character "${targetCharacterId}" not found in visual reference package.`
      );
    }
    if (targetIndex !== undefined) {
      if (targetIndex < 1 || targetIndex > found.reference_plates.length) {
        throw new VisualReferenceImageTaskError(
          `Target index ${targetIndex} out of range for character "${targetCharacterId}" (has ${found.reference_plates.length} plates).`
        );
      }
    }
  }

  if (targetEnvironmentId) {
    const found = packageClone.environment_keyframes.find(
      (env) => env.environment_id === targetEnvironmentId
    );
    if (!found) {
      throw new VisualReferenceImageTaskError(
        `Target environment "${targetEnvironmentId}" not found in visual reference package.`
      );
    }
    if (targetIndex !== undefined) {
      if (targetIndex < 1 || targetIndex > found.keyframes.length) {
        throw new VisualReferenceImageTaskError(
          `Target index ${targetIndex} out of range for environment "${targetEnvironmentId}" (has ${found.keyframes.length} keyframes).`
        );
      }
    }
  }

  let generatedCharacterImages = 0;
  let generatedEnvironmentImages = 0;

  if (!targetEnvironmentId || targetCharacterId) {
    for (let sheetIndex = 0; sheetIndex < packageClone.character_model_sheets.length; sheetIndex += 1) {
      const sheet = packageClone.character_model_sheets[sheetIndex]!;

      // Skip if targeting a different character
      if (targetCharacterId && sheet.character_id !== targetCharacterId) {
        continue;
      }

      for (let plateIndex = 0; plateIndex < sheet.reference_plates.length; plateIndex += 1) {
        const plate = sheet.reference_plates[plateIndex]!;

        // Skip if targeting a specific index
        if (targetCharacterId && targetIndex !== undefined && plateIndex + 1 !== targetIndex) {
          continue;
        }

        if (hasImagePath(plate.image_path)) {
          continue;
        }

        const userPrompt = plate.image_generation_prompt;
        const targetPath = buildVisualReferencePath(trimmedStoryId, 'characters', sheet.character_id, plateIndex + 1);
        const { category, filename } = splitRelativePath(trimmedStoryId, targetPath);

        logger?.debug?.('Generating character visual reference image', {
          storyId: trimmedStoryId,
          characterId: sheet.character_id,
          sheetIndex: sheetIndex + 1,
          plateIndex: plateIndex + 1,
          filename,
        });

        let imageData: Buffer;
        try {
          const result = await geminiClient.generateImage({
            userPrompt,
            aspectRatio: characterAspectRatio,
            timeoutMs: dependencies.timeoutMs,
            retry: dependencies.retry,
          });
          imageData = result.imageData;
        } catch (error) {
          throw new VisualReferenceImageTaskError(
            `Failed to generate image for character "${sheet.character_id}" plate #${plateIndex + 1}. ${extractErrorMessage(error)}`,
            { cause: error }
          );
        }

        let savedPath: string;
        try {
          savedPath = await imageStorage.saveImage(imageData, trimmedStoryId, category, filename);
        } catch (error) {
          throw new VisualReferenceImageTaskError(
            `Failed to persist image for character "${sheet.character_id}" plate #${plateIndex + 1}. ${extractErrorMessage(error)}`,
            { cause: error }
          );
        }

        plate.image_path = savedPath;
        generatedCharacterImages += 1;
      }
    }
  }

  if (!targetCharacterId || targetEnvironmentId) {
    for (let envIndex = 0; envIndex < packageClone.environment_keyframes.length; envIndex += 1) {
      const environment = packageClone.environment_keyframes[envIndex]!;

      // Skip if targeting a different environment
      if (targetEnvironmentId && environment.environment_id !== targetEnvironmentId) {
        continue;
      }

      for (let frameIndex = 0; frameIndex < environment.keyframes.length; frameIndex += 1) {
        const keyframe = environment.keyframes[frameIndex]!;

        // Skip if targeting a specific index
        if (targetEnvironmentId && targetIndex !== undefined && frameIndex + 1 !== targetIndex) {
          continue;
        }

        if (hasImagePath(keyframe.image_path)) {
          continue;
        }

        const userPrompt = keyframe.image_generation_prompt;
        const targetPath = buildVisualReferencePath(
          trimmedStoryId,
          'environments',
          environment.environment_id,
          frameIndex + 1
        );
        const { category, filename } = splitRelativePath(trimmedStoryId, targetPath);

        logger?.debug?.('Generating environment visual reference image', {
          storyId: trimmedStoryId,
          environmentId: environment.environment_id,
          environmentIndex: envIndex + 1,
          keyframeIndex: frameIndex + 1,
          filename,
        });

        let imageData: Buffer;
        try {
          const result = await geminiClient.generateImage({
            userPrompt,
            aspectRatio: environmentAspectRatio,
            timeoutMs: dependencies.timeoutMs,
            retry: dependencies.retry,
          });
          imageData = result.imageData;
        } catch (error) {
          throw new VisualReferenceImageTaskError(
            `Failed to generate image for environment "${environment.environment_id}" keyframe #${frameIndex + 1}. ${extractErrorMessage(error)}`,
            { cause: error }
          );
        }

        let savedPath: string;
        try {
          savedPath = await imageStorage.saveImage(imageData, trimmedStoryId, category, filename);
        } catch (error) {
          throw new VisualReferenceImageTaskError(
            `Failed to persist image for environment "${environment.environment_id}" keyframe #${frameIndex + 1}. ${extractErrorMessage(error)}`,
            { cause: error }
          );
        }

        keyframe.image_path = savedPath;
        generatedEnvironmentImages += 1;
      }
    }
  }

  if (generatedCharacterImages === 0 && generatedEnvironmentImages === 0) {
    return {
      storyId: trimmedStoryId,
      visualReferencePackage: packageClone,
      generatedCharacterImages,
      generatedEnvironmentImages,
    };
  }

  await storiesRepository.updateStoryArtifacts(trimmedStoryId, {
    visualReferencePackage: packageClone,
  });

  return {
    storyId: trimmedStoryId,
    visualReferencePackage: packageClone,
    generatedCharacterImages,
    generatedEnvironmentImages,
  };
}

function resolveGeminiClient(dependencies: VisualReferenceImageTaskDependencies): GeminiImageClient {
  if (dependencies.geminiImageClient) {
    return dependencies.geminiImageClient;
  }
  return createGeminiImageClient();
}

function resolveImageStorage(dependencies: VisualReferenceImageTaskDependencies): VisualReferenceImageStorage {
  if (dependencies.imageStorage) {
    return dependencies.imageStorage;
  }
  return new ImageStorageService();
}

function splitRelativePath(storyId: string, fullPath: string): { category: string; filename: string } {
  const prefix = `${storyId}/`;
  if (!fullPath.startsWith(prefix)) {
    throw new VisualReferenceImageTaskError(
      `Generated image path must start with the story id. Received: ${fullPath}`
    );
  }

  const remainder = fullPath.slice(prefix.length);
  const lastSlashIndex = remainder.lastIndexOf('/');
  if (lastSlashIndex === -1) {
    throw new VisualReferenceImageTaskError(
      `Generated image path must include a category directory. Received: ${fullPath}`
    );
  }

  const category = remainder.slice(0, lastSlashIndex);
  const filename = remainder.slice(lastSlashIndex + 1);

  if (!category || !filename) {
    throw new VisualReferenceImageTaskError(`Generated image path is missing category or filename. Received: ${fullPath}`);
  }

  return { category, filename };
}

function cloneVisualReferencePackage(raw: unknown): VisualReferencePackage | null {
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
      throw new VisualReferenceImageTaskError(
        'visual_reference_package must be valid JSON when provided as a string.'
      );
    }
  } else {
    parsed = raw;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new VisualReferenceImageTaskError('visual_reference_package must be an object.');
  }

  const clone = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;

  const characterSheetsRaw = clone.character_model_sheets;
  if (!Array.isArray(characterSheetsRaw)) {
    throw new VisualReferenceImageTaskError(
      'visual_reference_package.character_model_sheets must be an array.'
    );
  }

  const environmentEntriesRaw = clone.environment_keyframes;
  if (environmentEntriesRaw !== undefined && !Array.isArray(environmentEntriesRaw)) {
    throw new VisualReferenceImageTaskError(
      'visual_reference_package.environment_keyframes must be an array when provided.'
    );
  }

  const normalizedPackage: VisualReferencePackage = {
    ...clone,
    character_model_sheets: characterSheetsRaw.map((sheet, index) => normalizeCharacterSheet(sheet, index)),
    environment_keyframes: (environmentEntriesRaw ?? []).map((entry, index) =>
      normalizeEnvironmentEntry(entry, index)
    ),
  };

  return normalizedPackage;
}

function normalizeCharacterSheet(entry: unknown, index: number): VisualReferenceCharacterSheet {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new VisualReferenceImageTaskError(
      `visual_reference_package.character_model_sheets[${index}] must be an object.`
    );
  }

  const sheetRecord = { ...(entry as Record<string, unknown>) };
  const id = readStringField(
    sheetRecord,
    ['character_id', 'characterId'],
    `visual_reference_package.character_model_sheets[${index}].character_id`
  );

  const platesRaw = sheetRecord.reference_plates ?? sheetRecord.referencePlates;
  if (!Array.isArray(platesRaw)) {
    throw new VisualReferenceImageTaskError(
      `visual_reference_package.character_model_sheets[${index}].reference_plates must be an array.`
    );
  }

  const referencePlates = platesRaw.map((plate, plateIndex) =>
    normalizeCharacterPlate(plate, index, plateIndex)
  );

  delete sheetRecord.referencePlates;

  return {
    ...sheetRecord,
    character_id: id,
    reference_plates: referencePlates,
  } as VisualReferenceCharacterSheet;
}

function normalizeCharacterPlate(
  entry: unknown,
  sheetIndex: number,
  plateIndex: number
): VisualReferenceCharacterPlate {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new VisualReferenceImageTaskError(
      `visual_reference_package.character_model_sheets[${sheetIndex}].reference_plates[${plateIndex}] must be an object.`
    );
  }

  const plateRecord = { ...(entry as Record<string, unknown>) };

  const description = readStringField(
    plateRecord,
    ['plate_description', 'plateDescription'],
    `visual_reference_package.character_model_sheets[${sheetIndex}].reference_plates[${plateIndex}].plate_description`
  );
  const type = readStringField(
    plateRecord,
    ['type', 'plate_type'],
    `visual_reference_package.character_model_sheets[${sheetIndex}].reference_plates[${plateIndex}].type`
  );
  const prompt = readStringField(
    plateRecord,
    ['image_generation_prompt', 'imageGenerationPrompt'],
    `visual_reference_package.character_model_sheets[${sheetIndex}].reference_plates[${plateIndex}].image_generation_prompt`
  );

  const imagePath = readOptionalStringField(
    plateRecord,
    ['image_path', 'imagePath']
  );

  delete plateRecord.plateDescription;
  delete plateRecord.imageGenerationPrompt;
  delete plateRecord.plate_type;
  delete plateRecord.imagePath;

  return {
    ...plateRecord,
    plate_description: description,
    type,
    image_generation_prompt: prompt,
    ...(imagePath ? { image_path: imagePath } : {}),
  } as VisualReferenceCharacterPlate;
}

function normalizeEnvironmentEntry(entry: unknown, index: number): VisualReferenceEnvironmentEntry {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new VisualReferenceImageTaskError(
      `visual_reference_package.environment_keyframes[${index}] must be an object.`
    );
  }

  const environmentRecord = { ...(entry as Record<string, unknown>) };
  const id = readStringField(
    environmentRecord,
    ['environment_id', 'environmentId'],
    `visual_reference_package.environment_keyframes[${index}].environment_id`
  );
  const keyframesRaw = environmentRecord.keyframes ?? environmentRecord.environment_keyframes_entries;
  if (!Array.isArray(keyframesRaw)) {
    throw new VisualReferenceImageTaskError(
      `visual_reference_package.environment_keyframes[${index}].keyframes must be an array.`
    );
  }

  const keyframes = keyframesRaw.map((frame, frameIndex) =>
    normalizeEnvironmentKeyframe(frame, index, frameIndex)
  );

  delete environmentRecord.environmentId;
  delete environmentRecord.environment_keyframes_entries;

  return {
    ...environmentRecord,
    environment_id: id,
    keyframes,
  } as VisualReferenceEnvironmentEntry;
}

function normalizeEnvironmentKeyframe(
  entry: unknown,
  environmentIndex: number,
  frameIndex: number
): VisualReferenceEnvironmentKeyframe {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new VisualReferenceImageTaskError(
      `visual_reference_package.environment_keyframes[${environmentIndex}].keyframes[${frameIndex}] must be an object.`
    );
  }

  const frameRecord = { ...(entry as Record<string, unknown>) };
  const description = readStringField(
    frameRecord,
    ['keyframe_description', 'keyframeDescription'],
    `visual_reference_package.environment_keyframes[${environmentIndex}].keyframes[${frameIndex}].keyframe_description`
  );
  const prompt = readStringField(
    frameRecord,
    ['image_generation_prompt', 'imageGenerationPrompt'],
    `visual_reference_package.environment_keyframes[${environmentIndex}].keyframes[${frameIndex}].image_generation_prompt`
  );
  const imagePath = readOptionalStringField(frameRecord, ['image_path', 'imagePath']);

  delete frameRecord.keyframeDescription;
  delete frameRecord.imageGenerationPrompt;
  delete frameRecord.imagePath;

  return {
    ...frameRecord,
    keyframe_description: description,
    image_generation_prompt: prompt,
    ...(imagePath ? { image_path: imagePath } : {}),
  } as VisualReferenceEnvironmentKeyframe;
}

function readStringField(record: Record<string, unknown>, keys: string[], context: string): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        throw new VisualReferenceImageTaskError(`${context} must be a non-empty string.`);
      }
      record[keys[0]] = trimmed;
      if (key !== keys[0]) {
        delete record[key];
      }
      return trimmed;
    }
  }
  throw new VisualReferenceImageTaskError(`${context} must be a string.`);
}

function readOptionalStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      record[keys[0]] = trimmed;
      if (key !== keys[0]) {
        delete record[key];
      }
      return trimmed;
    }
  }
  return null;
}

function hasImagePath(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

