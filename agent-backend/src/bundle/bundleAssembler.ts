import { normalizeStoredSceneletContent } from '../interactive-story/sceneletUtils.js';
import type { SceneletRecord } from '../interactive-story/types.js';
import type { ShotRecord } from '../shot-production/types.js';
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

  const bundle: StoryBundle = {
    metadata,
    rootSceneletId: rootScenelet.id,
    scenelets: nodes,
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
      const hasAudio = Boolean(shot.audioFilePath?.trim?.());

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
