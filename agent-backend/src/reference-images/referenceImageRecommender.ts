import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ReferenceImageRecommendation,
  ReferenceImageRecommenderInput,
  ReferenceImageRecommenderOptions,
} from './types.js';
import type {
  VisualDesignCharacterDesign,
  VisualDesignDocument,
  VisualDesignEnvironmentDesign,
} from '../visual-design/types.js';

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
  const {
    storyId,
    referencedDesigns,
    basePublicPath = DEFAULT_BASE_PUBLIC_PATH,
    maxImages = DEFAULT_MAX_IMAGES,
    visualDesignDocument: rawVisualDesignDocument,
  } = input;
  const { validateFileExistence = true } = options;

  if (!storyId || typeof storyId !== 'string') {
    throw new ReferenceImageRecommenderError('storyId must be a non-empty string');
  }

  if (!referencedDesigns) {
    return [];
  }

  const visualDesignDocument = normalizeVisualDesignDocumentInput(rawVisualDesignDocument);

  const characterRecommendations = buildCharacterRecommendations(
    storyId,
    referencedDesigns.characters || [],
    visualDesignDocument,
    basePublicPath,
    validateFileExistence
  );

  const environmentRecommendations = buildEnvironmentRecommendations(
    storyId,
    referencedDesigns.environments || [],
    visualDesignDocument,
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
  visualDesignDocument: VisualDesignDocument | undefined,
  basePublicPath: string,
  validateFileExistence: boolean
): ReferenceImageRecommendation[] {
  const recommendations: ReferenceImageRecommendation[] = [];

  for (const characterId of characterIds) {
    const relativePath = resolveCharacterModelSheetPath(
      storyId,
      characterId,
      visualDesignDocument
    );
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
  visualDesignDocument: VisualDesignDocument | undefined,
  basePublicPath: string,
  validateFileExistence: boolean
): ReferenceImageRecommendation[] {
  const recommendations: ReferenceImageRecommendation[] = [];

  for (const environmentId of environmentIds) {
    const relativePath = resolveEnvironmentReferencePath(
      storyId,
      environmentId,
      visualDesignDocument
    );
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

function resolveCharacterModelSheetPath(
  storyId: string,
  characterId: string,
  visualDesignDocument: VisualDesignDocument | undefined
): string {
  if (!visualDesignDocument) {
    return `${storyId}/visuals/characters/${characterId}/${CHARACTER_MODEL_SHEET_FILENAME}`;
  }

  const design = findCharacterDesign(visualDesignDocument, characterId);
  if (!design) {
    throw new ReferenceImageRecommenderError(
      `Character '${characterId}' is referenced but not found in the visual design document. Run CREATE_VISUAL_DESIGN or regenerate the character design.`
    );
  }

  const imagePath = resolveCharacterImagePath(design);
  if (!imagePath) {
    throw new ReferenceImageRecommenderError(
      `Character '${characterId}' is referenced but has no character_model_sheet_image_path. Run CREATE_CHARACTER_MODEL_SHEET for this character first.`
    );
  }

  return imagePath;
}

function resolveEnvironmentReferencePath(
  storyId: string,
  environmentId: string,
  visualDesignDocument: VisualDesignDocument | undefined
): string {
  if (!visualDesignDocument) {
    return `${storyId}/visuals/environments/${environmentId}/${ENVIRONMENT_KEYFRAME_FILENAME}`;
  }

  const design = findEnvironmentDesign(visualDesignDocument, environmentId);
  if (!design) {
    throw new ReferenceImageRecommenderError(
      `Environment '${environmentId}' is referenced but not found in the visual design document. Run CREATE_VISUAL_DESIGN or regenerate the environment design.`
    );
  }

  const imagePath = resolveEnvironmentImagePath(design);
  if (!imagePath) {
    throw new ReferenceImageRecommenderError(
      `Environment '${environmentId}' is referenced but has no environment_reference_image_path. Run CREATE_ENVIRONMENT_REFERENCE_IMAGE for this environment first.`
    );
  }

  return imagePath;
}

function normalizeVisualDesignDocumentInput(
  raw: VisualDesignDocument | string | null | undefined
): VisualDesignDocument | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not object');
      }
      return parsed as VisualDesignDocument;
    } catch (error) {
      throw new ReferenceImageRecommenderError(
        'visualDesignDocument string must contain valid JSON describing the visual design document.'
      );
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as VisualDesignDocument;
  }

  throw new ReferenceImageRecommenderError(
    'visualDesignDocument must be an object or JSON string when provided.'
  );
}

function findCharacterDesign(
  document: VisualDesignDocument,
  characterId: string
): VisualDesignCharacterDesign | undefined {
  const designs = document.character_designs ?? document.characterDesigns;
  if (!Array.isArray(designs)) {
    return undefined;
  }

  return designs.find((design) =>
    design !== null &&
    typeof design === 'object' &&
    'character_id' in design &&
    (design as VisualDesignCharacterDesign).character_id === characterId
  ) as VisualDesignCharacterDesign | undefined;
}

function findEnvironmentDesign(
  document: VisualDesignDocument,
  environmentId: string
): VisualDesignEnvironmentDesign | undefined {
  const designs = document.environment_designs ?? document.environmentDesigns;
  if (!Array.isArray(designs)) {
    return undefined;
  }

  return designs.find((design) =>
    design !== null &&
    typeof design === 'object' &&
    'environment_id' in design &&
    (design as VisualDesignEnvironmentDesign).environment_id === environmentId
  ) as VisualDesignEnvironmentDesign | undefined;
}

function resolveCharacterImagePath(design: VisualDesignCharacterDesign): string | undefined {
  const pathCandidate =
    (design.character_model_sheet_image_path ?? (design as Record<string, unknown>).characterModelSheetImagePath) as
      | string
      | null
      | undefined;

  return normalizeVisualDesignImagePath(pathCandidate);
}

function resolveEnvironmentImagePath(design: VisualDesignEnvironmentDesign): string | undefined {
  const pathCandidate =
    (
      design.environment_reference_image_path ??
      (design as Record<string, unknown>).environmentReferenceImagePath
    ) as string | null | undefined;

  return normalizeVisualDesignImagePath(pathCandidate);
}

function normalizeVisualDesignImagePath(pathValue: string | null | undefined): string | undefined {
  if (typeof pathValue !== 'string') {
    return undefined;
  }

  const trimmed = pathValue.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalizedSlashes = trimmed.replace(/\\/g, '/');
  const withoutLeadingSlash = normalizedSlashes.replace(/^\/+/, '');

  const basePublicPrefix = 'apps/story-tree-ui/public/generated/';
  if (withoutLeadingSlash.startsWith(basePublicPrefix)) {
    return withoutLeadingSlash.slice(basePublicPrefix.length);
  }

  const generatedPrefix = 'generated/';
  if (withoutLeadingSlash.startsWith(generatedPrefix)) {
    return withoutLeadingSlash.slice(generatedPrefix.length);
  }

  return withoutLeadingSlash;
}
