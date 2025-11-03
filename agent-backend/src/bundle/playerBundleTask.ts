import path from 'node:path';
import * as fsPromises from 'node:fs/promises';

import { assembleBundleJson, BundleAssemblyError } from './bundleAssembler.js';
import { copyAssets } from './assetCopier.js';
import type {
  BundleAssemblerDependencies,
  PlayerBundleTaskDependencies,
  PlayerBundleTaskOptions,
  PlayerBundleTaskResult,
} from './types.js';
import {
  buildPlayerRuntimeInlineSource,
  writePlayerRuntimeModule,
} from '../player/runtime/compiler.js';
import { writePlayerThemeStyles } from '../player/theme.js';

const DEFAULT_OUTPUT_ROOT = path.resolve(process.cwd(), 'output/stories');
const DEFAULT_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  'agent-backend/src/bundle/templates/player.html'
);

/** Error wrapper used when bundle generation prerequisites fail. */
export class PlayerBundleTaskError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'PlayerBundleTaskError';
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Orchestrates generation of the standalone player bundle for the supplied story id.
 */
export async function runPlayerBundleTask(
  storyId: string,
  dependencies: PlayerBundleTaskDependencies,
  options: PlayerBundleTaskOptions = {}
): Promise<PlayerBundleTaskResult> {
  const trimmedStoryId = storyId?.trim?.() ?? '';
  if (!trimmedStoryId) {
    throw new PlayerBundleTaskError('Story id must be provided to create a player bundle.');
  }

  const fsAdapter = dependencies.fileSystem ?? fsPromises;
  const copyAssetsImpl = dependencies.copyAssets ?? copyAssets;
  const logger = dependencies.logger;

  logger?.debug?.('Starting player bundle task', { storyId: trimmedStoryId });

  const assemblerDependencies: BundleAssemblerDependencies = {
    storiesRepository: dependencies.storiesRepository,
    sceneletPersistence: dependencies.sceneletPersistence,
    shotsRepository: dependencies.shotsRepository,
  };

  const story = await assemblerDependencies.storiesRepository.getStoryById(trimmedStoryId);
  if (!story) {
    throw new PlayerBundleTaskError(`Story ${trimmedStoryId} was not found.`);
  }

  const shotsByScenelet = await assemblerDependencies.shotsRepository.getShotsByStory(trimmedStoryId);
  const hasShots = Object.values(shotsByScenelet).some((entries) => entries?.length);
  if (!hasShots) {
    throw new PlayerBundleTaskError(
      `Story ${trimmedStoryId} does not have any generated shots. Run CREATE_SHOT_PRODUCTION first.`
    );
  }

  const scenelets = await assemblerDependencies.sceneletPersistence.listSceneletsByStory(
    trimmedStoryId
  );

  const outputRoot = options.outputPath
    ? path.resolve(options.outputPath)
    : DEFAULT_OUTPUT_ROOT;
  const storyOutputDir = path.resolve(outputRoot, trimmedStoryId);

  const overwrite = Boolean(options.overwrite);
  const outputExists = await pathExists(fsAdapter, storyOutputDir);

  if (outputExists && !overwrite) {
    throw new PlayerBundleTaskError(
      `Bundle output directory ${storyOutputDir} already exists. Re-run with overwrite enabled to replace it.`
    );
  }

  if (outputExists && overwrite) {
    await fsAdapter.rm(storyOutputDir, { recursive: true, force: true });
  }

  await fsAdapter.mkdir(outputRoot, { recursive: true });

  const assetManifest = await copyAssetsImpl(trimmedStoryId, shotsByScenelet, outputRoot, {
    generatedAssetsRoot: options.generatedAssetsRoot,
    audioDesignDocument: story.audioDesignDocument,
    scenelets,
    logger,
  });

  if (assetManifest.size === 0) {
    throw new PlayerBundleTaskError(
      `Story ${trimmedStoryId} does not have any playable assets. Complete shot generation before bundling.`
    );
  }

  const exportedAt = options.exportedAt ?? new Date().toISOString();

  let bundle;
  try {
    ({ bundle } = await assembleBundleJson(trimmedStoryId, assemblerDependencies, {
      assetManifest,
      preloadedShots: shotsByScenelet,
      exportedAt,
      logger,
    }));
  } catch (error) {
    if (error instanceof BundleAssemblyError) {
      throw new PlayerBundleTaskError(error.message, { cause: error });
    }
    throw error;
  }

  await validateAssetReferences(fsAdapter, storyOutputDir, bundle.scenelets);

  const templatePath = options.templatePath ? path.resolve(options.templatePath) : DEFAULT_TEMPLATE_PATH;

  await fsAdapter.mkdir(storyOutputDir, { recursive: true });

  const playerTemplate = await fsPromises.readFile(templatePath, 'utf-8');
  const inlineRuntimeSource = await buildPlayerRuntimeInlineSource();
  const playerHtmlWithStory = injectStoryJsonIntoTemplate(playerTemplate, bundle);
  const playerHtml = injectRuntimeIntoTemplate(playerHtmlWithStory, inlineRuntimeSource);
  const playerHtmlPath = path.join(storyOutputDir, 'player.html');
  await fsAdapter.writeFile(playerHtmlPath, playerHtml, 'utf-8');

  const storyJsonPath = path.join(storyOutputDir, 'story.json');
  await fsAdapter.writeFile(storyJsonPath, JSON.stringify(bundle, null, 2), 'utf-8');
  await writePlayerRuntimeModule(storyOutputDir);
  await writePlayerThemeStyles(storyOutputDir);

  logger?.debug?.('Player bundle generated', {
    storyId: trimmedStoryId,
    outputPath: storyOutputDir,
  });

  return {
    storyId: trimmedStoryId,
    outputPath: storyOutputDir,
  };
}

function injectRuntimeIntoTemplate(template: string, runtimeSource: string): string {
  const placeholder = '__PLAYER_RUNTIME_PLACEHOLDER__';
  if (!template.includes(placeholder)) {
    throw new PlayerBundleTaskError('Player template is missing the runtime placeholder.');
  }

  const escapedRuntime = runtimeSource.replace(/<\/script/gi, '<\\/script');
  const indentedRuntime = escapedRuntime
    .split('\n')
    .map((line) => `        ${line}`)
    .join('\n');

  return template.replace(placeholder, indentedRuntime);
}

function injectStoryJsonIntoTemplate(template: string, story: unknown): string {
  const placeholder = '__STORY_JSON_PLACEHOLDER__';
  if (!template.includes(placeholder)) {
    throw new PlayerBundleTaskError('Player template is missing the story data placeholder.');
  }

  const rawJson = JSON.stringify(story);
  const escapedJson = rawJson.replace(/<\/script/gi, '<\\/script');

  return template.replace(placeholder, escapedJson);
}

async function pathExists(
  fsAdapter: Pick<typeof fsPromises, 'access'>,
  targetPath: string
): Promise<boolean> {
  try {
    await fsAdapter.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function validateAssetReferences(
  fsAdapter: Pick<typeof fsPromises, 'access'>,
  storyOutputDir: string,
  scenelets: ReadonlyArray<{
    shots: ReadonlyArray<{ imagePath: string | null; audioPath: string | null }>;
    branchAudioPath: string | null;
  }>
): Promise<void> {
  for (const scenelet of scenelets) {
    for (const shot of scenelet.shots) {
      if (shot.imagePath) {
        await ensureFileExists(fsAdapter, path.join(storyOutputDir, shot.imagePath));
      }
      if (shot.audioPath) {
        await ensureFileExists(fsAdapter, path.join(storyOutputDir, shot.audioPath));
      }
    }
    if (scenelet.branchAudioPath) {
      await ensureFileExists(fsAdapter, path.join(storyOutputDir, scenelet.branchAudioPath));
    }
  }
}

async function ensureFileExists(fsAdapter: Pick<typeof fsPromises, 'access'>, targetPath: string): Promise<void> {
  try {
    await fsAdapter.access(targetPath);
  } catch (error) {
    throw new PlayerBundleTaskError(
      `Bundle validation failed: required asset ${targetPath} is missing after copy.`,
      { cause: error }
    );
  }
}
