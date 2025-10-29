import path from 'node:path';

import { normalizeNameForPath } from '../image-generation/normalizeNameForPath.js';

type VisualCategory = 'characters' | 'environments';
type ShotFrameType = 'first_frame' | 'key_frame';

const STORY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export function buildVisualReferencePath(
  storyId: string,
  category: VisualCategory,
  name: string,
  index: number
): string {
  assertSafeSegment(storyId, 'Story ID');
  assertVisualCategory(category);
  const normalizedIndex = ensurePositiveIndex(index);
  const normalizedName = normalizeNameForPath(name);
  const fileName = category === 'characters' ? `model_sheet_${normalizedIndex}.png` : `keyframe_${normalizedIndex}.png`;

  return path.posix.join(storyId, 'visuals', category, normalizedName, fileName);
}

export function buildShotImagePath(
  storyId: string,
  sceneletId: string,
  shotIndex: number,
  frameType: ShotFrameType
): string {
  assertSafeSegment(storyId, 'Story ID');
  assertSceneletId(sceneletId);
  const normalizedIndex = ensurePositiveIndex(shotIndex);
  assertFrameType(frameType);

  const fileName = `${sceneletId}_shot_${normalizedIndex}_${frameType}.png`;
  return path.posix.join(storyId, 'shots', fileName);
}

export function validateImagePath(imagePath: string): void {
  const trimmed = imagePath.trim();
  if (!trimmed) {
    throw new Error('Image path must be provided.');
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('\\') || /^[a-zA-Z]:/.test(trimmed)) {
    throw new Error('Image path must be relative.');
  }
  if (trimmed.includes('\\')) {
    throw new Error('Image path must use forward slashes.');
  }
  if (trimmed.includes('..')) {
    throw new Error('Image path contains invalid segments.');
  }

  const segments = trimmed.split('/');
  if (segments.length < 2) {
    throw new Error('Image path must include at least a story and category segment.');
  }

  if (!STORY_ID_PATTERN.test(segments[0])) {
    throw new Error('Image path must start with a valid story identifier.');
  }

  for (const segment of segments) {
    if (!segment) {
      throw new Error('Image path contains invalid segments.');
    }
  }
}

function ensurePositiveIndex(index: number): number {
  if (!Number.isInteger(index) || index <= 0) {
    throw new Error('Image index must be a positive integer.');
  }
  return index;
}

function assertVisualCategory(category: string): asserts category is VisualCategory {
  if (category !== 'characters' && category !== 'environments') {
    throw new Error('Visual reference category must be "characters" or "environments".');
  }
}

function assertFrameType(frameType: string): asserts frameType is ShotFrameType {
  if (frameType !== 'first_frame' && frameType !== 'key_frame') {
    throw new Error('Frame type must be "first_frame" or "key_frame".');
  }
}

function assertSceneletId(sceneletId: string): void {
  if (!sceneletId || sceneletId.trim().length === 0) {
    throw new Error('Scenelet ID must be provided.');
  }
  if (path.isAbsolute(sceneletId) || sceneletId.includes('/') || sceneletId.includes('\\') || sceneletId.includes('..')) {
    throw new Error('Scenelet ID contains invalid path characters.');
  }
}

function assertSafeSegment(value: string, label: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${label} must be provided.`);
  }
  if (path.isAbsolute(value) || value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new Error(`${label} contains invalid path characters.`);
  }
}
