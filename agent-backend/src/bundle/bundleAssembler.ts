import { normalizeStoredSceneletContent } from '../interactive-story/sceneletUtils.js';
import type { SceneletRecord } from '../interactive-story/types.js';
import type { ShotRecord } from '../shot-production/types.js';
import { SKIPPED_AUDIO_PLACEHOLDER } from '../shot-audio/constants.js';
import type { AudioMusicCue } from '../audio-design/types.js';
import {
  type AssetManifest,
  type BundleAssemblerDependencies,
  type BundleAssemblerOptions,
  type BundleAssemblyResult,
  type BundleLogger,
  type NextNode,
  type SceneletShotAssetMap,
  type SceneletNode,
  type ShotAssetPaths,
  type ShotNode,
  type StoryBundle,
  type StoryMusicManifest,
} from './types.js';

class BundleAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BundleAssemblyError';
  }
}

export { BundleAssemblyError };

/**
 * Builds a JSON representation of the story bundle that the standalone player consumes.
 *
 * @param storyId - Identifier of the story to export.
 * @param dependencies - Data repositories required to load story content.
 * @param options - Optional overrides such as exportedAt timestamp or logger implementation.
 */
export async function assembleBundleJson(
  storyId: string,
  dependencies: BundleAssemblerDependencies,
  options: BundleAssemblerOptions = {}
): Promise<BundleAssemblyResult> {
  const normalizedId = storyId?.trim?.() ?? '';
  if (!normalizedId) {
    throw new BundleAssemblyError('Story id must be provided to assemble bundle JSON.');
  }

  const { storiesRepository, sceneletPersistence, shotsRepository } = dependencies;
  if (!storiesRepository || !sceneletPersistence || !shotsRepository) {
    throw new BundleAssemblyError('Bundle assembler requires stories, scenelet, and shot repositories.');
  }

  const story = await storiesRepository.getStoryById(normalizedId);
  if (!story) {
    throw new BundleAssemblyError(`Story ${normalizedId} not found.`);
  }

  const scenelets = await sceneletPersistence.listSceneletsByStory(normalizedId);
  if (!scenelets.length) {
    throw new BundleAssemblyError(`Story ${normalizedId} does not have any scenelets to bundle.`);
  }

  const roots = scenelets.filter((scenelet) => scenelet.parentId === null);
  if (roots.length === 0) {
    throw new BundleAssemblyError(`Story ${normalizedId} is missing a root scenelet.`);
  }
  if (roots.length > 1) {
    throw new BundleAssemblyError(`Story ${normalizedId} has multiple root scenelets.`);
  }

  const rootScenelet = roots[0];

  const shotsByScenelet = options.preloadedShots ?? (await shotsRepository.getShotsByStory(normalizedId));
  const manifest = options.assetManifest ?? buildManifestFromShotMap(shotsByScenelet, options.logger);

  const sceneletAliasMap = buildSceneletAliasMap(shotsByScenelet);

  if (!manifest.size) {
    throw new BundleAssemblyError(`Story ${normalizedId} does not have any playable shots.`);
  }

  const availableSceneletIds = new Set(manifest.keys());
  if (!availableSceneletIds.has(rootScenelet.id)) {
    throw new BundleAssemblyError(
      `Root scenelet ${rootScenelet.id} does not have playable assets. Cannot assemble bundle.`
    );
  }

  const childrenByParent = buildChildrenMap(scenelets);
  const reachableSceneletIds = computeReachableSceneletIds(
    rootScenelet.id,
    availableSceneletIds,
    childrenByParent
  );
  const orderedScenelets = scenelets.filter((scenelet) => reachableSceneletIds.has(scenelet.id));

  const nodes: SceneletNode[] = [];
  for (const scenelet of orderedScenelets) {
    const assetsForScenelet = manifest.get(scenelet.id);
    if (!assetsForScenelet || assetsForScenelet.size === 0) {
      continue;
    }

    const shots = buildShotNodes(scenelet.id, assetsForScenelet);
    if (!shots.length) {
      continue;
    }

    const description = extractSceneletDescription(scenelet);
    const childScenelets = childrenByParent.get(scenelet.id) ?? [];
    const next = determineNextState(scenelet, childScenelets, availableSceneletIds);

    nodes.push({
      id: scenelet.id,
      description,
      shots,
      next,
    });
  }

  if (!nodes.length) {
    throw new BundleAssemblyError(`Story ${normalizedId} does not have any playable scenelets.`);
  }

  const metadata = {
    storyId: normalizedId,
    title: story.displayName?.trim?.() || 'Untitled Story',
    exportedAt: options.exportedAt ?? new Date().toISOString(),
  } satisfies StoryBundle['metadata'];

  const music = buildMusicManifest({
    audioDesign: story.audioDesignDocument,
    sceneletIdsInBundle: new Set(nodes.map((node) => node.id)),
    sceneletAliases: sceneletAliasMap,
    logger: options.logger,
  });

  const bundle: StoryBundle = {
    metadata,
    rootSceneletId: rootScenelet.id,
    scenelets: nodes,
    music,
  };

  options.logger?.debug?.('Assembled story bundle JSON', {
    storyId: normalizedId,
    sceneletCount: nodes.length,
  });

  const filteredManifest: AssetManifest = new Map();
  for (const sceneletId of reachableSceneletIds) {
    const entry = manifest.get(sceneletId);
    if (entry) {
      filteredManifest.set(sceneletId, entry);
    }
  }

  return {
    bundle,
    assetManifest: filteredManifest,
  };
}

/**
 * Computes the next node metadata for a scenelet based on available child scenelets.
 */
export function determineNextState(
  scenelet: SceneletRecord,
  childScenelets: SceneletRecord[],
  availableSceneletIds: Set<string>
) : NextNode {
  if (scenelet.isTerminalNode) {
    return { type: 'terminal' };
  }

  const playableChildren = childScenelets.filter((child) => availableSceneletIds.has(child.id));

  if (scenelet.isBranchPoint) {
    if (!scenelet.choicePrompt || !scenelet.choicePrompt.trim()) {
      throw new BundleAssemblyError(
        `Scenelet ${scenelet.id} is marked as a branch point but is missing a choice prompt.`
      );
    }

    if (childScenelets.length < 2) {
      throw new BundleAssemblyError(
        `Scenelet ${scenelet.id} is marked as a branch point but has fewer than two children.`
      );
    }

    if (playableChildren.length >= 2) {
      return {
        type: 'branch',
        choicePrompt: scenelet.choicePrompt.trim(),
        choices: playableChildren.map((child) => {
          const label = child.choiceLabelFromParent?.trim();
          if (!label) {
            throw new BundleAssemblyError(
              `Scenelet ${child.id} is missing a choice label from parent ${scenelet.id}.`
            );
          }
          return {
            sceneletId: child.id,
            label,
          };
        }),
      };
    }

    if (playableChildren.length === 1) {
      return {
        type: 'linear',
        sceneletId: playableChildren[0].id,
      };
    }

    return { type: 'incomplete' };
  }

  if (childScenelets.length === 0) {
    throw new BundleAssemblyError(
      `Scenelet ${scenelet.id} is missing children required for linear continuation.`
    );
  }

  if (playableChildren.length === 0) {
    return { type: 'incomplete' };
  }

  if (playableChildren.length > 1) {
    throw new BundleAssemblyError(
      `Scenelet ${scenelet.id} is expected to be linear but has multiple playable children.`
    );
  }

  return {
    type: 'linear',
    sceneletId: playableChildren[0].id,
  };
}

/**
 * Produces an asset manifest by inspecting available shots grouped by scenelet.
 */
export function buildManifestFromShotMap(
  shotsByScenelet: Record<string, ShotRecord[]>,
  logger?: BundleLogger
): AssetManifest {
  const manifest: AssetManifest = new Map();

  // Keys in `shotsByScenelet` are scenelet UUIDs (`scenelet_ref`).
  // The manifest preserves those UUID keys so lookups align with `SceneletRecord.id` values.
  for (const [sceneletId, shots] of Object.entries(shotsByScenelet)) {
    if (!Array.isArray(shots) || shots.length === 0) {
      continue;
    }

    const shotMap: SceneletShotAssetMap = new Map();

    for (const shot of shots) {
      const hasImage = Boolean(shot.keyFrameImagePath?.trim?.());
      const hasAudio = hasPlayableAudioPath(shot.audioFilePath);

      if (!hasImage && !hasAudio) {
        continue;
      }

      const assetPaths: ShotAssetPaths = {
        imagePath: hasImage ? buildImageRelativePath(sceneletId, shot.shotIndex) : null,
        audioPath: hasAudio ? buildAudioRelativePath(sceneletId, shot.shotIndex) : null,
      };

      shotMap.set(shot.shotIndex, assetPaths);
    }

    if (shotMap.size > 0) {
      manifest.set(sceneletId, shotMap);
    } else {
      logger?.warn?.('Scenelet skipped due to missing assets', { sceneletId });
    }
  }

  return manifest;
}

export function buildEmbeddedManifest(
  shotsByScenelet: Record<string, ShotRecord[]>,
  logger?: BundleLogger
): AssetManifest {
  const manifest: AssetManifest = new Map();

  for (const [sceneletId, shots] of Object.entries(shotsByScenelet)) {
    if (!Array.isArray(shots) || shots.length === 0) {
      continue;
    }

    const shotMap: SceneletShotAssetMap = new Map();

    for (const shot of shots) {
      const imagePath = normalizeGeneratedAssetPath(shot.keyFrameImagePath);
      const audioPath = hasPlayableAudioPath(shot.audioFilePath)
        ? normalizeGeneratedAssetPath(shot.audioFilePath)
        : null;

      if (!imagePath && !audioPath) {
        continue;
      }

      shotMap.set(shot.shotIndex, { imagePath, audioPath });
    }

    if (shotMap.size > 0) {
      manifest.set(sceneletId, shotMap);
    } else {
      logger?.warn?.('Scenelet skipped due to missing embedded assets', { sceneletId });
    }
  }

  return manifest;
}

function hasPlayableAudioPath(path?: string | null): boolean {
  const trimmed = path?.trim?.();
  if (!trimmed) {
    return false;
  }
  return trimmed.toUpperCase() !== SKIPPED_AUDIO_PLACEHOLDER;
}

function normalizeGeneratedAssetPath(raw?: string | null): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const withoutRelativePrefix = value.replace(/^\.\//, '').replace(/^\//, '');
  if (withoutRelativePrefix.startsWith('generated/')) {
    return `/${withoutRelativePrefix}`;
  }

  if (value.startsWith('/generated/')) {
    return value;
  }

  return `/generated/${withoutRelativePrefix}`;
}

function buildChildrenMap(scenelets: SceneletRecord[]): Map<string, SceneletRecord[]> {
  const childrenByParent = new Map<string, SceneletRecord[]>();

  for (const scenelet of scenelets) {
    if (!scenelet.parentId) {
      continue;
    }

    const list = childrenByParent.get(scenelet.parentId) ?? [];
    list.push(scenelet);
    childrenByParent.set(scenelet.parentId, list);
  }

  return childrenByParent;
}

function buildShotNodes(sceneletId: string, assets: SceneletShotAssetMap): ShotNode[] {
  const shotIndices = [...assets.keys()].sort((a, b) => a - b);
  const shots: ShotNode[] = [];

  for (const shotIndex of shotIndices) {
    const entry = assets.get(shotIndex);
    if (!entry) {
      continue;
    }

    if (!entry.imagePath && !entry.audioPath) {
      continue;
    }

    shots.push({
      shotIndex,
      imagePath: entry.imagePath,
      audioPath: entry.audioPath,
    });
  }

  return shots;
}

function extractSceneletDescription(scenelet: SceneletRecord): string {
  const normalized = normalizeStoredSceneletContent(scenelet.content, scenelet.id);
  const description = normalized.description?.trim?.();
  if (description) {
    return description;
  }
  return `Scenelet ${scenelet.id}`;
}

function computeReachableSceneletIds(
  rootSceneletId: string,
  availableSceneletIds: Set<string>,
  childrenByParent: Map<string, SceneletRecord[]>
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  if (availableSceneletIds.has(rootSceneletId)) {
    queue.push(rootSceneletId);
  }

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (reachable.has(current)) {
      continue;
    }
    reachable.add(current);

    const children = childrenByParent.get(current) ?? [];
    for (const child of children) {
      if (availableSceneletIds.has(child.id) && !reachable.has(child.id)) {
        queue.push(child.id);
      }
    }
  }

  return reachable;
}

/** Returns the normalized bundle-relative path for a shot image asset. */
export function buildImageRelativePath(sceneletId: string, shotIndex: number): string {
  return `assets/shots/${sceneletId}/${shotIndex}_key_frame.png`;
}

/** Returns the normalized bundle-relative path for a shot audio asset. */
export function buildAudioRelativePath(sceneletId: string, shotIndex: number): string {
  return `assets/shots/${sceneletId}/${shotIndex}_audio.wav`;
}

export function buildMusicRelativePath(cueName: string): string {
  const base = typeof cueName === 'string' ? cueName.trim() : '';
  const sanitized = sanitizeCueFileName(base);
  return `assets/music/${sanitized}.m4a`;
}

interface MusicManifestInput {
  audioDesign: unknown;
  sceneletIdsInBundle: Set<string>;
  sceneletAliases: Map<string, string>;
  logger?: BundleLogger;
}

function buildMusicManifest(input: MusicManifestInput): StoryMusicManifest {
  const manifest: StoryMusicManifest = {
    cues: [],
    sceneletCueMap: {},
  };

  const { audioDesign, sceneletIdsInBundle, sceneletAliases, logger } = input;
  if (!audioDesign) {
    return manifest;
  }

  const cues = extractMusicCuesFromAudioDesign(audioDesign, logger);
  if (!cues.length) {
    return manifest;
  }

  const assignedScenelets = new Map<string, string>();

  cues.forEach((cue, index) => {
    const cueName = cue.cue_name?.toString?.().trim?.();
    if (!cueName) {
      logger?.warn?.('Skipping music cue without cue_name', { cueIndex: index });
      return;
    }

    const sceneletIdsRaw = normalizeAssociatedScenelets(cue);
    if (!sceneletIdsRaw.length) {
      logger?.warn?.('Skipping music cue without associated scenelet ids', {
        cueName,
      });
      return;
    }

    warnIfNonConsecutive(sceneletIdsRaw, cueName, logger);

    const seenForCue = new Set<string>();
    const filteredScenelets: string[] = [];

    for (const sceneletIdRaw of sceneletIdsRaw) {
      const alias = sceneletIdRaw.trim();
      const resolvedSceneletId = sceneletAliases.get(alias) ?? alias;
      if (!sceneletIdsInBundle.has(resolvedSceneletId)) {
        logger?.warn?.('Music cue references scenelet not present in bundle', {
          cueName,
          sceneletAlias: alias,
          resolvedSceneletId,
        });
        continue;
      }

      if (seenForCue.has(resolvedSceneletId)) {
        continue;
      }
      seenForCue.add(resolvedSceneletId);

      const existing = assignedScenelets.get(resolvedSceneletId);
      if (existing && existing !== cueName) {
        logger?.warn?.('Scenelet already assigned to different music cue', {
          sceneletId: resolvedSceneletId,
          existingCue: existing,
          newCue: cueName,
        });
        continue;
      }

      filteredScenelets.push(resolvedSceneletId);
    }

    if (!filteredScenelets.length) {
      return;
    }

    const audioPath = buildMusicRelativePath(cueName);
    manifest.cues.push({
      cueName,
      sceneletIds: filteredScenelets,
      audioPath,
    });

    filteredScenelets.forEach((sceneletId) => {
      assignedScenelets.set(sceneletId, cueName);
      manifest.sceneletCueMap[sceneletId] = cueName;
    });
  });

  return manifest;
}

function buildSceneletAliasMap(shotsByScenelet: Record<string, ShotRecord[]>): Map<string, string> {
  const map = new Map<string, string>();

  for (const [sceneletRef, shots] of Object.entries(shotsByScenelet)) {
    if (!Array.isArray(shots)) {
      continue;
    }

    for (const shot of shots) {
      const alias = shot?.sceneletId?.toString?.().trim?.();
      if (alias && !map.has(alias)) {
        map.set(alias, sceneletRef);
        break;
      }
    }
  }

  return map;
}

export function extractMusicCuesFromAudioDesign(raw: unknown, logger?: BundleLogger): AudioMusicCue[] {
  let payload: unknown = raw;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload) as Record<string, unknown>;
    } catch (error) {
      logger?.warn?.('Audio design document could not be parsed as JSON', {
        message: (error as Error).message,
      });
      return [];
    }
  }

  if (!payload || typeof payload !== 'object') {
    logger?.warn?.('Audio design document is not an object; skipping music cues');
    return [];
  }

  const record = payload as Record<string, unknown>;
  const nested = record.audio_design_document ?? record.audioDesignDocument;
  const doc = nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : record;

  const cues = doc.music_and_ambience_cues ?? doc.musicAndAmbienceCues;
  if (!Array.isArray(cues)) {
    return [];
  }

  return cues.filter((cue): cue is AudioMusicCue => {
    if (!cue || typeof cue !== 'object') {
      logger?.warn?.('Skipping invalid music cue entry', { type: typeof cue });
      return false;
    }
    return true;
  });
}

function normalizeAssociatedScenelets(cue: AudioMusicCue): string[] {
  const list =
    (Array.isArray((cue as Record<string, unknown>).associated_scenelet_ids)
      ? (cue as Record<string, unknown>).associated_scenelet_ids
      : Array.isArray((cue as Record<string, unknown>).associatedSceneletIds)
        ? (cue as Record<string, unknown>).associatedSceneletIds
        : []) as unknown[];

  return list
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
}

function warnIfNonConsecutive(sceneletIds: string[], cueName: string, logger?: BundleLogger): void {
  if (sceneletIds.length <= 1) {
    return;
  }

  const numericIds = sceneletIds.map((id) => parseSceneletIndex(id)).filter((value): value is number => value !== null);
  if (numericIds.length !== sceneletIds.length) {
    return;
  }

  for (let index = 1; index < numericIds.length; index += 1) {
    if (numericIds[index] !== numericIds[index - 1] + 1) {
      logger?.warn?.('Music cue associated scenelets are not consecutive', {
        cueName,
        sceneletIds,
      });
      return;
    }
  }
}

function parseSceneletIndex(sceneletId: string): number | null {
  const match = sceneletId.match(/scenelet-(\d+)/i);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function sanitizeCueFileName(value: string): string {
  const trimmed = value.trim();
  const sanitized = trimmed
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized) {
    return sanitized;
  }

  return 'music-cue';
}
