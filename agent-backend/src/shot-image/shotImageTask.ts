import * as fs from 'node:fs/promises';
import type {
  ShotImageTaskDependencies,
  ShotImageTaskResult,
  ReferenceImageLoader,
} from './types.js';
import { ShotImageTaskError, CharacterReferenceMissingError } from './errors.js';
import { createReferenceImageLoader } from './referenceImageLoader.js';
import { normalizeNameForPath } from '../image-generation/normalizeNameForPath.js';
import { recommendReferenceImages, ReferenceImageRecommenderError } from '../reference-images/index.js';
import { loadReferenceImagesFromPaths, ReferenceImageLoadError } from '../image-generation/index.js';
import type { ReferencedDesigns } from '../shot-production/types.js';
import type { VisualDesignDocument } from '../visual-design/types.js';

const DEFAULT_ASPECT_RATIO = '16:9';

interface StoryboardPayload {
  characters?: Array<{ name: string }> | string[];
  character_names?: string[];
  referencedDesigns?: ReferencedDesigns;
  [key: string]: unknown;
}

/**
 * Generates missing shot images for a story using Gemini.
 *
 * Requires the story to have a visual design document so character model sheet
 * and environment reference image paths can be resolved directly from the design metadata.
 * Falls back to legacy character reference loading when storyboard payloads do not
 * specify referenced designs.
 */
export async function runShotImageTask(
  storyId: string,
  dependencies: ShotImageTaskDependencies
): Promise<ShotImageTaskResult> {
  const {
    storiesRepository,
    shotsRepository,
    geminiImageClient,
    imageStorage,
    referenceImageLoader = createReferenceImageLoader(),
    logger,
    aspectRatio = DEFAULT_ASPECT_RATIO,
  } = dependencies;

  if (!geminiImageClient) {
    throw new ShotImageTaskError('geminiImageClient is required for shot image generation');
  }

  if (!imageStorage) {
    throw new ShotImageTaskError('imageStorage is required for shot image generation');
  }

  logger?.debug?.('Starting shot image generation task', { storyId });

  // Load story to get visual design document
  const story = await storiesRepository.getStoryById(storyId);
  if (!story) {
    throw new ShotImageTaskError(`Story not found: ${storyId}`);
  }

  if (story.visualDesignDocument === null || story.visualDesignDocument === undefined) {
    throw new ShotImageTaskError(
      `Story ${storyId} does not have a visual design document. Run CREATE_VISUAL_DESIGN first.`
    );
  }

  const visualDesignDocument = parseVisualDesignDocument(story.visualDesignDocument, storyId);

  const targetSceneletId = dependencies.targetSceneletId?.trim();
  const targetShotIndex = dependencies.targetShotIndex;

  // Find shots missing images
  const shotsMissingImages = await shotsRepository.findShotsMissingImages(storyId);

  // Filter by target if specified
  let shotsToProcess = shotsMissingImages;
  if (targetSceneletId) {
    shotsToProcess = shotsMissingImages.filter((shot) => shot.sceneletId === targetSceneletId);
    if (shotsToProcess.length === 0) {
      throw new ShotImageTaskError(
        `Target scenelet "${targetSceneletId}" not found in story or has no missing images.`
      );
    }
  }
  if (targetShotIndex !== undefined) {
    shotsToProcess = shotsToProcess.filter((shot) => shot.shotIndex === targetShotIndex);
    if (shotsToProcess.length === 0) {
      const targetDesc = targetSceneletId
        ? `shot ${targetShotIndex} in scenelet "${targetSceneletId}"`
        : `shot with index ${targetShotIndex}`;
      throw new ShotImageTaskError(
        `Target ${targetDesc} not found in story or has no missing images.`
      );
    }
  }

  if (shotsToProcess.length === 0) {
    logger?.debug?.('All shots already have images', { storyId });
    return {
      generatedFirstFrameImages: 0,
      generatedKeyFrameImages: 0,
      totalShots: 0,
    };
  }

  logger?.debug?.('Found shots missing images', {
    storyId,
    count: shotsToProcess.length,
  });

  // Load all shots for the story
  const shotsByScenelet = await shotsRepository.getShotsByStory(storyId);

  let generatedFirstFrameImages = 0;
  let generatedKeyFrameImages = 0;

  // Process each shot that needs images
  for (const shotInfo of shotsToProcess) {
    const { sceneletId, shotIndex, missingFirstFrame, missingKeyFrame } = shotInfo;
    const shots = shotsByScenelet[sceneletId];
    if (!shots) {
      logger?.debug?.('Scenelet not found in shots data', { sceneletId, storyId });
      continue;
    }

    const shot = shots.find((s) => s.shotIndex === shotIndex);
    if (!shot) {
      logger?.debug?.('Shot not found', { sceneletId, shotIndex, storyId });
      continue;
    }

    // Extract referencedDesigns from storyboard payload
    const storyboardPayload = shot.storyboardPayload as StoryboardPayload;
    const referencedDesigns = storyboardPayload?.referencedDesigns;

    let referenceImageBuffers: Array<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' }> = [];

    if (referencedDesigns) {
      // Use new reference image recommender (with referencedDesigns field)
      try {
        const recommendations = recommendReferenceImages({
          storyId,
          referencedDesigns,
          maxImages: 5,
          visualDesignDocument,
        });

        if (dependencies.verbose && recommendations.length > 0) {
          console.log(`[Shot ${sceneletId} #${shotIndex}] Using reference images:`);
          for (const rec of recommendations) {
            console.log(`  - ${rec.type}: ${rec.id} -> ${rec.path}`);
          }
        }

        const referenceImagePaths = recommendations.map((rec) => rec.path);
        referenceImageBuffers = loadReferenceImagesFromPaths(referenceImagePaths);
      } catch (error) {
        if (error instanceof ReferenceImageRecommenderError || error instanceof ReferenceImageLoadError) {
          logger?.debug?.('Failed to load reference images from referencedDesigns', {
            sceneletId,
            shotIndex,
            referencedDesigns,
            error: error.message,
          });
          throw new ShotImageTaskError(
            `Failed to load reference images for shot ${sceneletId}#${shotIndex}: ${error.message}`
          );
        }
        throw error;
      }
    } else {
      // Fall back to existing character-based approach (backward compatibility)
      const characterNames = extractCharacterNames(shot.storyboardPayload);

      let characterReferences: Map<string, string[]>;
      try {
        characterReferences = await referenceImageLoader.loadCharacterReferences(
          storyId,
          characterNames,
          3
        );
      } catch (error) {
        logger?.debug?.('Failed to load character references', {
          sceneletId,
          shotIndex,
          characterNames,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new CharacterReferenceMissingError(characterNames.join(', '), storyId);
      }

      // Collect all reference image paths
      const referenceImagePaths: string[] = [];
      for (const paths of characterReferences.values()) {
        referenceImagePaths.push(...paths);
      }

      // Read reference images as buffers
      referenceImageBuffers = await Promise.all(
        referenceImagePaths.map(async (imagePath) => {
          const buffer = await fs.readFile(imagePath);
          return {
            data: buffer,
            mimeType: imagePath.endsWith('.png') ? ('image/png' as const) : ('image/jpeg' as const),
          };
        })
      );
    }

    // Generate first frame image if missing
    if (missingFirstFrame) {
      logger?.debug?.('Generating first frame image', { sceneletId, shotIndex });

      const firstFrameResult = await geminiImageClient.generateImage({
        userPrompt: shot.firstFramePrompt,
        referenceImages: referenceImageBuffers.slice(0, 3),
        aspectRatio,
      });

      const normalizedSceneletId = normalizeNameForPath(sceneletId);
      const firstFrameFilename = `shot-${shotIndex}_first_frame.png`;
      const firstFrameImagePath = await imageStorage.saveImage(
        firstFrameResult.imageData,
        storyId,
        `shots/${normalizedSceneletId}`,
        firstFrameFilename
      );

      await shotsRepository.updateShotImagePaths(storyId, sceneletId, shotIndex, {
        firstFrameImagePath,
      });

      generatedFirstFrameImages++;
    }

    // Generate key frame image if missing
    if (missingKeyFrame) {
      logger?.debug?.('Generating key frame image', { sceneletId, shotIndex });

      const keyFrameResult = await geminiImageClient.generateImage({
        userPrompt: shot.keyFramePrompt,
        referenceImages: referenceImageBuffers.slice(0, 3),
        aspectRatio,
      });

      const normalizedSceneletId = normalizeNameForPath(sceneletId);
      const keyFrameFilename = `shot-${shotIndex}_key_frame.png`;
      const keyFrameImagePath = await imageStorage.saveImage(
        keyFrameResult.imageData,
        storyId,
        `shots/${normalizedSceneletId}`,
        keyFrameFilename
      );

      await shotsRepository.updateShotImagePaths(storyId, sceneletId, shotIndex, {
        keyFrameImagePath,
      });

      generatedKeyFrameImages++;
    }
  }

  logger?.debug?.('Shot image generation complete', {
    storyId,
    generatedFirstFrameImages,
    generatedKeyFrameImages,
    totalShots: shotsMissingImages.length,
  });

  return {
    generatedFirstFrameImages,
    generatedKeyFrameImages,
    totalShots: shotsMissingImages.length,
  };
}

function extractCharacterNames(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const typedPayload = payload as StoryboardPayload;

  // Try different possible structures
  if (Array.isArray(typedPayload.character_names)) {
    return typedPayload.character_names.filter((name): name is string => typeof name === 'string');
  }

  if (Array.isArray(typedPayload.characters)) {
    return typedPayload.characters
      .map((char) => {
        if (typeof char === 'string') return char;
        if (char && typeof char === 'object' && 'name' in char && typeof char.name === 'string') {
          return char.name;
        }
        return null;
      })
      .filter((name): name is string => name !== null);
  }

  return [];
}

function parseVisualDesignDocument(raw: unknown, storyId: string): VisualDesignDocument {
  if (raw === null || raw === undefined) {
    throw new ShotImageTaskError(
      `Story ${storyId} does not have a visual design document. Run CREATE_VISUAL_DESIGN first.`
    );
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new ShotImageTaskError(
        `Visual design document for story ${storyId} is an empty string. Run CREATE_VISUAL_DESIGN before generating shot images.`
      );
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ShotImageTaskError(
          `Visual design document for story ${storyId} must be a JSON object.`
        );
      }
      return parsed as VisualDesignDocument;
    } catch (error) {
      throw new ShotImageTaskError(
        `Visual design document for story ${storyId} must contain valid JSON.`,
        error as Error
      );
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as VisualDesignDocument;
  }

  throw new ShotImageTaskError(
    `Visual design document for story ${storyId} must be a JSON object.`
  );
}
