import { assembleBundleJson, buildEmbeddedManifest, BundleAssemblyError } from '../bundle/bundleAssembler.js';
import type {
  BundleAssemblerDependencies,
  BundleLogger,
  StoryBundle,
  StoryMusicManifest,
} from '../bundle/types.js';

export interface EmbeddedBundleOptions {
  exportedAt?: string;
  logger?: BundleLogger;
}

export async function loadEmbeddedStoryBundle(
  storyId: string,
  dependencies: BundleAssemblerDependencies,
  options: EmbeddedBundleOptions = {}
): Promise<StoryBundle> {
  const normalizedId = storyId?.trim?.() ?? '';
  if (!normalizedId) {
    throw new BundleAssemblyError('Story id must be provided to load embedded story bundle data.');
  }

  const [shotsByScenelet, scenelets] = await Promise.all([
    dependencies.shotsRepository.getShotsByStory(normalizedId),
    dependencies.sceneletPersistence.listSceneletsByStory(normalizedId),
  ]);
  const assetManifest = buildEmbeddedManifest(shotsByScenelet, scenelets, options.logger);

  const { bundle } = await assembleBundleJson(normalizedId, dependencies, {
    assetManifest,
    preloadedShots: shotsByScenelet,
    exportedAt: options.exportedAt,
    logger: options.logger,
  });

  bundle.music = remapMusicManifestForEmbedded(bundle.music, normalizedId);

  return bundle;
}

function remapMusicManifestForEmbedded(
  manifest: StoryMusicManifest,
  storyId: string
): StoryMusicManifest {
  const cues = Array.isArray(manifest?.cues)
    ? manifest.cues.map((cue) => {
        const fileName = cue.audioPath?.split('/').pop();
        const audioPath = fileName ? `/generated/${storyId}/music/${fileName}` : cue.audioPath ?? null;
        return {
          ...cue,
          audioPath,
        };
      })
    : [];

  return {
    cues,
    sceneletCueMap: { ...(manifest?.sceneletCueMap ?? {}) },
  };
}
