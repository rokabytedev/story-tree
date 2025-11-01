import type * as fsPromises from 'node:fs/promises';

import type { SceneletPersistence } from '../interactive-story/types.js';
import type { ShotProductionShotsRepository, ShotRecord } from '../shot-production/types.js';
import type { AgentWorkflowStoriesRepository } from '../workflow/types.js';

export interface StoryMetadata {
  storyId: string;
  title: string;
  exportedAt: string;
}

export interface ShotNode {
  shotIndex: number;
  imagePath: string | null;
  audioPath: string | null;
}

export interface BranchChoice {
  label: string;
  sceneletId: string;
}

export type NextNode =
  | { type: 'terminal' }
  | { type: 'linear'; sceneletId: string }
  | { type: 'branch'; choicePrompt: string; choices: BranchChoice[] }
  | { type: 'incomplete' };

export interface SceneletNode {
  id: string;
  description: string;
  shots: ShotNode[];
  next: NextNode;
}

export interface StoryBundle {
  metadata: StoryMetadata;
  rootSceneletId: string;
  scenelets: SceneletNode[];
}

export interface ShotAssetPaths {
  imagePath: string | null;
  audioPath: string | null;
}

export type SceneletShotAssetMap = Map<number, ShotAssetPaths>;

export type AssetManifest = Map<string, SceneletShotAssetMap>;

export interface BundleAssemblyResult {
  bundle: StoryBundle;
  assetManifest: AssetManifest;
}

export type CopyAssetsFn = (
  storyId: string,
  shotsByScenelet: Record<string, ShotRecord[]>,
  outputPath: string,
  options?: AssetCopierOptions
) => Promise<AssetManifest>;

export type CopyPlayerTemplateFn = (
  templatePath: string,
  storyOutputDir: string
) => Promise<void>;

export interface BundleLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
  warn?(message: string, metadata?: Record<string, unknown>): void;
}

export interface BundleAssemblerDependencies {
  storiesRepository: AgentWorkflowStoriesRepository;
  sceneletPersistence: SceneletPersistence;
  shotsRepository: ShotProductionShotsRepository;
}

export interface BundleAssemblerOptions {
  logger?: BundleLogger;
  exportedAt?: string;
  assetManifest?: AssetManifest;
  preloadedShots?: Record<string, ShotRecord[]>;
}

export type FileSystemAdapter = Pick<typeof fsPromises, 'mkdir' | 'copyFile' | 'stat' | 'access'>;

export interface AssetCopierOptions {
  generatedAssetsRoot?: string;
  logger?: BundleLogger;
  fileSystem?: FileSystemAdapter;
}

export interface PlayerBundleTaskOptions {
  outputPath?: string;
  overwrite?: boolean;
  templatePath?: string;
  generatedAssetsRoot?: string;
  exportedAt?: string;
}

export interface PlayerBundleTaskDependencies extends BundleAssemblerDependencies {
  copyAssets?: CopyAssetsFn;
  copyPlayerTemplate?: CopyPlayerTemplateFn;
  fileSystem?: Pick<typeof fsPromises, 'rm' | 'mkdir' | 'writeFile' | 'access' | 'stat'>;
  logger?: BundleLogger;
}

export interface PlayerBundleTaskResult {
  storyId: string;
  outputPath: string;
}
