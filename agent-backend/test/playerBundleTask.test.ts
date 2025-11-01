import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { SceneletRecord } from '../src/interactive-story/types.js';
import type { ShotRecord } from '../src/shot-production/types.js';
import { runPlayerBundleTask, PlayerBundleTaskError } from '../src/bundle/playerBundleTask.js';
import type { PlayerBundleTaskDependencies } from '../src/bundle/types.js';

const ISO_NOW = '2024-03-01T00:00:00.000Z';
const TMP_PREFIX = 'player-bundle-task-test-';

function createScenelet(overrides: Partial<SceneletRecord> = {}): SceneletRecord {
  const id = overrides.id ?? 'scenelet-root';
  return {
    id,
    storyId: overrides.storyId ?? 'story-test',
    parentId: overrides.parentId ?? null,
    choiceLabelFromParent: overrides.choiceLabelFromParent ?? null,
    choicePrompt: overrides.choicePrompt ?? null,
    content:
      overrides.content ??
      {
        description: `Description for ${id}`,
        dialogue: [],
        shot_suggestions: [],
      },
    isBranchPoint: overrides.isBranchPoint ?? false,
    isTerminalNode: overrides.isTerminalNode ?? false,
    createdAt: overrides.createdAt ?? ISO_NOW,
  };
}

function createShotRecord(overrides: Partial<ShotRecord> = {}): ShotRecord {
  return {
    sceneletSequence: overrides.sceneletSequence ?? 1,
    shotIndex: overrides.shotIndex ?? 1,
    storyboardPayload: overrides.storyboardPayload ?? {},
    keyFrameImagePath: overrides.keyFrameImagePath,
    audioFilePath: overrides.audioFilePath,
    createdAt: overrides.createdAt ?? ISO_NOW,
    updatedAt: overrides.updatedAt ?? ISO_NOW,
  };
}

describe('runPlayerBundleTask', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    while (tempRoots.length > 0) {
      const dir = tempRoots.pop();
      if (dir) {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('creates a player bundle with assets, story JSON, and template', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
    tempRoots.push(root);

    const storyId = 'story-alpha';
    const generatedRoot = path.join(root, 'generated');
    const outputRoot = path.join(root, 'output');
    const templatePath = path.join(root, 'player-template.html');

    await fs.writeFile(templatePath, '<html><body>Player Template</body></html>', 'utf-8');

    const sceneletId = 'root';
    const shotsDir = path.join(generatedRoot, storyId, 'shots', sceneletId);
    await fs.mkdir(shotsDir, { recursive: true });
    await fs.writeFile(path.join(shotsDir, 'shot-1_key_frame.png'), Buffer.from('image'));
    await fs.writeFile(path.join(shotsDir, '1_audio.wav'), Buffer.from('audio'));

    const dependencies = createDependencies({
      storyId,
      scenelets: [
        createScenelet({ id: 'root', storyId }),
        createScenelet({ id: 'leaf', storyId, parentId: 'root', isTerminalNode: true }),
      ],
      shotsByScenelet: {
        root: [
          createShotRecord({
            shotIndex: 1,
            keyFrameImagePath: `${storyId}/shots/${sceneletId}/shot-1_key_frame.png`,
            audioFilePath: `generated/${storyId}/shots/${sceneletId}/1_audio.wav`,
          }),
        ],
        leaf: [
          createShotRecord({
            shotIndex: 1,
            keyFrameImagePath: `${storyId}/shots/leaf/shot-1_key_frame.png`,
          }),
        ],
      },
    });

    // create asset for leaf scenelet
    const leafDir = path.join(generatedRoot, storyId, 'shots', 'leaf');
    await fs.mkdir(leafDir, { recursive: true });
    await fs.writeFile(path.join(leafDir, 'shot-1_key_frame.png'), Buffer.from('leaf-image'));

    const result = await runPlayerBundleTask(storyId, dependencies, {
      generatedAssetsRoot: generatedRoot,
      outputPath: outputRoot,
      templatePath,
      exportedAt: ISO_NOW,
    });

    expect(result.outputPath).toBe(path.join(outputRoot, storyId));
    const storyJsonPath = path.join(result.outputPath, 'story.json');
    const playerHtmlPath = path.join(result.outputPath, 'player.html');

    const storyJson = JSON.parse(await fs.readFile(storyJsonPath, 'utf-8')) as {
      metadata: { exportedAt: string };
      scenelets: Array<{ id: string; shots: Array<{ imagePath: string | null; audioPath: string | null }> }>;
    };

    expect(storyJson.metadata.exportedAt).toBe(ISO_NOW);
    expect(storyJson.scenelets).toHaveLength(2);
    expect(await fs.readFile(playerHtmlPath, 'utf-8')).toContain('Player Template');

    const imageTarget = path.join(result.outputPath, 'assets', 'shots', 'root', '1_key_frame.png');
    const audioTarget = path.join(result.outputPath, 'assets', 'shots', 'root', '1_audio.wav');
    await expect(fs.stat(imageTarget)).resolves.toBeDefined();
    await expect(fs.stat(audioTarget)).resolves.toBeDefined();
  });

  it('throws when bundle directory exists and overwrite is false', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
    tempRoots.push(root);

    const storyId = 'story-beta';
    const outputRoot = path.join(root, 'output');
    const generatedRoot = path.join(root, 'generated');
    const storyOutputDir = path.join(outputRoot, storyId);

    await fs.mkdir(storyOutputDir, { recursive: true });

    const dependencies = createDependencies({
      storyId,
      scenelets: [createScenelet({ id: 'root', storyId })],
      shotsByScenelet: {
        root: [
          createShotRecord({
            shotIndex: 1,
            keyFrameImagePath: `${storyId}/shots/root/shot-1_key_frame.png`,
          }),
        ],
      },
    });

    const shotsDir = path.join(generatedRoot, storyId, 'shots', 'root');
    await fs.mkdir(shotsDir, { recursive: true });
    await fs.writeFile(path.join(shotsDir, 'shot-1_key_frame.png'), Buffer.from('image'));

    await expect(
      runPlayerBundleTask(storyId, dependencies, {
        generatedAssetsRoot: generatedRoot,
        outputPath: outputRoot,
      })
    ).rejects.toBeInstanceOf(PlayerBundleTaskError);
  });

  it('throws when no playable assets are available', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
    tempRoots.push(root);

    const storyId = 'story-empty';

    const dependencies = createDependencies({
      storyId,
      scenelets: [createScenelet({ id: 'root', storyId })],
      shotsByScenelet: {
        root: [createShotRecord({ shotIndex: 1 })],
      },
    });

    await expect(
      runPlayerBundleTask(storyId, dependencies, {
        generatedAssetsRoot: path.join(root, 'generated'),
        outputPath: path.join(root, 'output'),
      })
    ).rejects.toBeInstanceOf(PlayerBundleTaskError);
  });
});

interface DependencyInput {
  storyId: string;
  scenelets: SceneletRecord[];
  shotsByScenelet: Record<string, ShotRecord[]>;
}

function createDependencies(input: DependencyInput): PlayerBundleTaskDependencies {
  const { storyId, scenelets, shotsByScenelet } = input;

  return {
    storiesRepository: {
      createStory: async () => {
        throw new Error('Not implemented');
      },
      updateStoryArtifacts: async () => {
        throw new Error('Not implemented');
      },
      getStoryById: async (id: string) =>
        id === storyId
          ? {
              id: storyId,
              displayName: 'Story Title',
              displayNameUpper: 'STORY TITLE',
              initialPrompt: 'Prompt',
              createdAt: ISO_NOW,
              updatedAt: ISO_NOW,
              storyConstitution: null,
              visualDesignDocument: null,
              audioDesignDocument: null,
              visualReferencePackage: null,
            }
          : null,
      listStories: async () => [],
      deleteStoryById: async () => {
        throw new Error('Not implemented');
      },
    },
    sceneletPersistence: {
      createScenelet: async () => {
        throw new Error('Not implemented');
      },
      markSceneletAsBranchPoint: async () => {
        throw new Error('Not implemented');
      },
      markSceneletAsTerminal: async () => {
        throw new Error('Not implemented');
      },
      hasSceneletsForStory: async () => true,
      listSceneletsByStory: async (id: string) => (id === storyId ? scenelets : []),
    },
    shotsRepository: {
      createSceneletShots: async () => {
        throw new Error('Not implemented');
      },
      findSceneletIdsMissingShots: async () => [],
      getShotsByStory: async (id: string) => (id === storyId ? shotsByScenelet : {}),
      findShotsMissingImages: async () => [],
      updateShotImagePaths: async () => {
        throw new Error('Not implemented');
      },
      updateShotAudioPath: async () => {
        throw new Error('Not implemented');
      },
    },
  };
}
