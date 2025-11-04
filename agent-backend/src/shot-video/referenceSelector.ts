import { existsSync } from 'node:fs';
import path from 'node:path';

import { recommendReferenceImages } from '../reference-images/index.js';
import type {
  ReferenceImageRecommendation,
  ReferenceImageRecommenderOptions,
} from '../reference-images/types.js';
import type { ShotRecord, ShotProductionStoryboardEntry } from '../shot-production/types.js';
import type { VisualDesignDocument } from '../visual-design/types.js';
import { ShotVideoTaskError } from './errors.js';

const DEFAULT_BASE_PUBLIC_PATH = path.resolve(
  process.cwd(),
  'apps/story-tree-ui/public/generated'
);

export type VideoReferenceType = 'CHARACTER' | 'ENVIRONMENT' | 'KEY_FRAME';

export interface VideoReferenceSelection {
  path: string;
  type: VideoReferenceType;
  id?: string;
}

export interface SelectVideoReferenceImagesOptions {
  storyId: string;
  shot: ShotRecord;
  visualDesignDocument: VisualDesignDocument;
  basePublicPath?: string;
  recommenderOptions?: Partial<ReferenceImageRecommenderOptions>;
  validateFileExistence?: boolean;
  maxImages?: number;
}

export function selectVideoReferenceImages(
  options: SelectVideoReferenceImagesOptions
): VideoReferenceSelection[] {
  const {
    storyId,
    shot,
    visualDesignDocument,
    basePublicPath = DEFAULT_BASE_PUBLIC_PATH,
    validateFileExistence = true,
  } = options;

  const normalizedBasePath = path.resolve(basePublicPath);

  const storyboard = extractStoryboard(shot.storyboardPayload);
  const referencedDesigns = storyboard.referencedDesigns;

  if (!referencedDesigns) {
    throw new ShotVideoTaskError(
      `Shot ${shot.sceneletId}#${shot.shotIndex} is missing referencedDesigns in the storyboard payload.`
    );
  }

  let recommendations: ReferenceImageRecommendation[] = [];
  try {
    recommendations = recommendReferenceImages(
      {
        storyId,
        referencedDesigns,
        basePublicPath: normalizedBasePath,
        visualDesignDocument,
        maxImages: options.maxImages,
      },
      {
        validateFileExistence,
        ...options.recommenderOptions,
      }
    );
  } catch (error) {
    throw new ShotVideoTaskError(
      `Failed to resolve reference images for shot ${shot.sceneletId}#${shot.shotIndex}.`,
      error instanceof Error ? error : undefined
    );
  }

  const selections: VideoReferenceSelection[] = [];
  const seenPaths = new Set<string>();

  // Priority 0: character model sheets
  for (const recommendation of recommendations) {
    if (recommendation.type !== 'CHARACTER') {
      continue;
    }
    enqueueRecommendation(selections, seenPaths, recommendation, 'CHARACTER');
  }

  // Priority 1: environment reference images
  for (const recommendation of recommendations) {
    if (recommendation.type !== 'ENVIRONMENT') {
      continue;
    }
    enqueueRecommendation(selections, seenPaths, recommendation, 'ENVIRONMENT');
  }

  // Priority 2: existing key frame image
  // Disable key frame for now because it causes the video to be bad.
  // if (typeof shot.keyFrameImagePath === 'string' && shot.keyFrameImagePath.trim()) {
  //   const absolute = resolveGeneratedAssetPath(shot.keyFrameImagePath, normalizedBasePath);
  //   if (absolute && existsSync(absolute)) {
  //     enqueueSelection(selections, seenPaths, {
  //       path: absolute,
  //       type: 'KEY_FRAME',
  //       id: `${shot.sceneletId}#${shot.shotIndex}`,
  //     });
  //   }
  // }

  const requestedLimit = options.maxImages;
  const safeLimit =
    typeof requestedLimit === 'number' && requestedLimit >= 0
      ? Math.min(requestedLimit, 3)
      : 3;

  return selections.slice(0, safeLimit);
}

function enqueueRecommendation(
  selections: VideoReferenceSelection[],
  seenPaths: Set<string>,
  recommendation: ReferenceImageRecommendation,
  type: Exclude<VideoReferenceType, 'KEY_FRAME'>
): void {
  if (!recommendation.path) {
    return;
  }

  enqueueSelection(selections, seenPaths, {
    path: recommendation.path,
    type,
    id: recommendation.id,
  });
}

function enqueueSelection(
  selections: VideoReferenceSelection[],
  seenPaths: Set<string>,
  selection: VideoReferenceSelection
): void {
  const canonicalPath = path.resolve(selection.path);
  if (seenPaths.has(canonicalPath)) {
    return;
  }
  seenPaths.add(canonicalPath);
  selections.push({
    ...selection,
    path: canonicalPath,
  });
}

function resolveGeneratedAssetPath(relativePath: string, baseGeneratedPath: string): string {
  let normalized = relativePath.trim();

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  if (normalized.startsWith('generated/')) {
    normalized = normalized.slice('generated/'.length);
  }

  return path.resolve(baseGeneratedPath, normalized);
}

function extractStoryboard(payload: unknown): ShotProductionStoryboardEntry {
  if (!payload || typeof payload !== 'object') {
    throw new ShotVideoTaskError('Shot storyboard payload must be an object to select references.');
  }
  return payload as ShotProductionStoryboardEntry;
}
