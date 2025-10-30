import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ReferenceImageRecommendation,
  ReferenceImageRecommenderInput,
  ReferenceImageRecommenderOptions,
} from './types.js';

const DEFAULT_BASE_PUBLIC_PATH = 'apps/story-tree-ui/public/generated';
const DEFAULT_MAX_IMAGES = 5;
const CHARACTER_MODEL_SHEET_FILENAME = 'character-model-sheet-1.png';
const ENVIRONMENT_KEYFRAME_FILENAME = 'keyframe_1.png';

export class ReferenceImageRecommenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceImageRecommenderError';
  }
}

export function recommendReferenceImages(
  input: ReferenceImageRecommenderInput,
  options: ReferenceImageRecommenderOptions = {}
): ReferenceImageRecommendation[] {
  const { storyId, referencedDesigns, basePublicPath = DEFAULT_BASE_PUBLIC_PATH, maxImages = DEFAULT_MAX_IMAGES } = input;
  const { validateFileExistence = true } = options;

  if (!storyId || typeof storyId !== 'string') {
    throw new ReferenceImageRecommenderError('storyId must be a non-empty string');
  }

  if (!referencedDesigns) {
    return [];
  }

  const characterRecommendations = buildCharacterRecommendations(
    storyId,
    referencedDesigns.characters || [],
    basePublicPath,
    validateFileExistence
  );

  const environmentRecommendations = buildEnvironmentRecommendations(
    storyId,
    referencedDesigns.environments || [],
    basePublicPath,
    validateFileExistence
  );

  // Prioritize characters over environments
  const allRecommendations = [...characterRecommendations, ...environmentRecommendations];

  // Apply upload limit
  return allRecommendations.slice(0, maxImages);
}

function buildCharacterRecommendations(
  storyId: string,
  characterIds: string[],
  basePublicPath: string,
  validateFileExistence: boolean
): ReferenceImageRecommendation[] {
  const recommendations: ReferenceImageRecommendation[] = [];

  for (const characterId of characterIds) {
    const relativePath = `${storyId}/visuals/characters/${characterId}/${CHARACTER_MODEL_SHEET_FILENAME}`;
    const fullPath = join(basePublicPath, relativePath);

    if (validateFileExistence && !existsSync(fullPath)) {
      throw new ReferenceImageRecommenderError(
        `Character model sheet not found for '${characterId}': ${fullPath}`
      );
    }

    recommendations.push({
      type: 'CHARACTER',
      id: characterId,
      path: fullPath,
      description: `Character model sheet for ${characterId}`,
    });
  }

  return recommendations;
}

function buildEnvironmentRecommendations(
  storyId: string,
  environmentIds: string[],
  basePublicPath: string,
  validateFileExistence: boolean
): ReferenceImageRecommendation[] {
  const recommendations: ReferenceImageRecommendation[] = [];

  for (const environmentId of environmentIds) {
    const relativePath = `${storyId}/visuals/environments/${environmentId}/${ENVIRONMENT_KEYFRAME_FILENAME}`;
    const fullPath = join(basePublicPath, relativePath);

    if (validateFileExistence && !existsSync(fullPath)) {
      throw new ReferenceImageRecommenderError(
        `Environment keyframe not found for '${environmentId}': ${fullPath}`
      );
    }

    recommendations.push({
      type: 'ENVIRONMENT',
      id: environmentId,
      path: fullPath,
      description: `Environment keyframe for ${environmentId}`,
    });
  }

  return recommendations;
}
