import type { ShotImageTaskDependencies, ShotImageTaskResult } from './types.js';
import { ShotImageTaskError } from './errors.js';
import { assembleKeyFramePrompt } from './keyFramePromptAssembler.js';
import { normalizeNameForPath } from '../image-generation/normalizeNameForPath.js';
import { recommendReferenceImages, ReferenceImageRecommenderError } from '../reference-images/index.js';
import { loadReferenceImagesFromPaths, ReferenceImageLoadError } from '../image-generation/index.js';
import type { ReferencedDesigns, ShotProductionStoryboardEntry } from '../shot-production/types.js';
import type { VisualDesignDocument } from '../visual-design/types.js';

const DEFAULT_ASPECT_RATIO = '16:9';

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

  let generatedKeyFrameImages = 0;

  // Process each shot that needs images
  for (const shotInfo of shotsToProcess) {
    const { sceneletId, shotIndex, missingKeyFrame } = shotInfo;
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

    if (!missingKeyFrame) {
      logger?.debug?.('Skipping shot with existing key frame image', { sceneletId, shotIndex });
      continue;
    }

    const storyboard = shot.storyboardPayload as ShotProductionStoryboardEntry;
    const referencedDesigns = storyboard?.referencedDesigns;
    if (!referencedDesigns) {
      throw new ShotImageTaskError(
        `Shot ${sceneletId}#${shotIndex} is missing referenced designs in the storyboard payload.`
      );
    }

    const promptObject = assembleKeyFramePrompt(shot, visualDesignDocument);

    let referenceImageBuffers: Array<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' }> = [];

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

    logger?.debug?.('Generating key frame image', { sceneletId, shotIndex });

    const keyFrameResult = await geminiImageClient.generateImage({
      userPrompt: JSON.stringify(promptObject),
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
    generatedKeyFrameImages,
    totalShots: shotsMissingImages.length,
  });

  return {
    generatedKeyFrameImages,
    totalShots: shotsMissingImages.length,
  };
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
