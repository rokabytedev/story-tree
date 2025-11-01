import { describe, expect, it } from 'vitest';

import type { SceneletRecord } from '../../interactive-story/types.js';
import type { ShotRecord } from '../../shot-production/types.js';
import {
  assembleBundleJson,
  BundleAssemblyError,
} from '../src/bundle/bundleAssembler.js';
import type { AssetManifest, BundleAssemblerDependencies } from '../src/bundle/types.js';

const ISO_NOW = '2024-01-01T00:00:00.000Z';

function createScenelet(overrides: Partial<SceneletRecord> = {}): SceneletRecord {
  const id = overrides.id ?? 'scenelet-root';
  return {
    id,
    storyId: overrides.storyId ?? 'story-1',
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
    sceneletRef: overrides.sceneletRef ?? 'scenelet-ref',
    sceneletId: overrides.sceneletId ?? 'scenelet-1',
    sceneletSequence: overrides.sceneletSequence ?? 1,
    shotIndex: overrides.shotIndex ?? 1,
    storyboardPayload: overrides.storyboardPayload ?? {},
    keyFrameImagePath: overrides.keyFrameImagePath,
    audioFilePath: overrides.audioFilePath,
    createdAt: overrides.createdAt ?? ISO_NOW,
    updatedAt: overrides.updatedAt ?? ISO_NOW,
  };
}

describe('assembleBundleJson', () => {
  it('assembles linear story bundle with metadata and linear next state', async () => {
    const storyId = 'linear-story';
    const scenelets = [
      createScenelet({ id: 'root', storyId }),
      createScenelet({ id: 'child', storyId, parentId: 'root', isTerminalNode: true }),
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      root: [
        createShotRecord({
          sceneletRef: 'root',
          sceneletId: 'root',
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/root/shot-1_key_frame.png`,
        }),
      ],
      child: [
        createShotRecord({
          sceneletRef: 'child',
          sceneletId: 'child',
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/child/shot-1_key_frame.png`,
        }),
      ],
    };

    const dependencies = makeDependencies({ storyId, scenelets, shotsByScenelet });

    const { bundle } = await assembleBundleJson(storyId, dependencies, {
      exportedAt: ISO_NOW,
    });

    expect(bundle.metadata).toMatchObject({ storyId, title: 'Story Title', exportedAt: ISO_NOW });
    expect(bundle.rootSceneletId).toBe('root');
    expect(bundle.scenelets).toHaveLength(2);

    const root = bundle.scenelets.find((node) => node.id === 'root');
    expect(root?.shots).toHaveLength(1);
    expect(root?.next).toEqual({ type: 'linear', sceneletId: 'child' });

    const child = bundle.scenelets.find((node) => node.id === 'child');
    expect(child?.next).toEqual({ type: 'terminal' });
  });

  it('converts branch to linear when only one child has playable assets', async () => {
    const storyId = 'branch-story';
    const scenelets = [
      createScenelet({ id: 'root', storyId, isBranchPoint: true, choicePrompt: 'Pick a path' }),
      createScenelet({
        id: 'left',
        storyId,
        parentId: 'root',
        choiceLabelFromParent: 'Left',
        isTerminalNode: true,
      }),
      createScenelet({
        id: 'right',
        storyId,
        parentId: 'root',
        choiceLabelFromParent: 'Right',
        isTerminalNode: true,
      }),
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      root: [
        createShotRecord({
          sceneletRef: 'root',
          sceneletId: 'root',
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/root/shot-1_key_frame.png`,
        }),
      ],
      left: [
        createShotRecord({
          sceneletRef: 'left',
          sceneletId: 'left',
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/left/shot-1_key_frame.png`,
        }),
      ],
      right: [],
    };

    const manifest: AssetManifest = new Map([
      [
        'root',
        new Map([[1, { imagePath: 'assets/shots/root/1_key_frame.png', audioPath: null }]]),
      ],
      [
        'left',
        new Map([[1, { imagePath: 'assets/shots/left/1_key_frame.png', audioPath: null }]]),
      ],
    ]);

    const dependencies = makeDependencies({ storyId, scenelets, shotsByScenelet });

    const { bundle } = await assembleBundleJson(storyId, dependencies, {
      assetManifest: manifest,
      preloadedShots: shotsByScenelet,
      exportedAt: ISO_NOW,
    });

    expect(bundle.scenelets).toHaveLength(2);
    const root = bundle.scenelets.find((node) => node.id === 'root');
    expect(root?.next).toEqual({ type: 'linear', sceneletId: 'left' });
  });

  it('marks scenelet as incomplete when no playable children remain', async () => {
    const storyId = 'incomplete-story';
    const scenelets = [
      createScenelet({ id: 'root', storyId }),
      createScenelet({ id: 'child', storyId, parentId: 'root', isTerminalNode: true }),
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      root: [
        createShotRecord({
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/root/shot-1_key_frame.png`,
        }),
      ],
      child: [],
    };

    const manifest: AssetManifest = new Map([
      [
        'root',
        new Map([[1, { imagePath: 'assets/shots/root/1_key_frame.png', audioPath: null }]]),
      ],
    ]);

    const dependencies = makeDependencies({ storyId, scenelets, shotsByScenelet });

    const { bundle } = await assembleBundleJson(storyId, dependencies, {
      assetManifest: manifest,
      preloadedShots: shotsByScenelet,
    });

    expect(bundle.scenelets).toHaveLength(1);
    expect(bundle.scenelets[0]?.next).toEqual({ type: 'incomplete' });
  });

  it('throws when root scenelet is missing playable assets', async () => {
    const storyId = 'no-root-assets';
    const scenelets = [createScenelet({ id: 'root', storyId })];

    const dependencies = makeDependencies({ storyId, scenelets, shotsByScenelet: { root: [] } });

    await expect(
      assembleBundleJson(storyId, dependencies, {
        assetManifest: new Map(),
        preloadedShots: { root: [] },
      })
    ).rejects.toBeInstanceOf(BundleAssemblyError);
  });
});

interface DependencyInput {
  storyId: string;
  scenelets: SceneletRecord[];
  shotsByScenelet: Record<string, ShotRecord[]>;
}

function makeDependencies(input: DependencyInput): BundleAssemblerDependencies {
  const { storyId, scenelets, shotsByScenelet } = input;

  return {
    storiesRepository: {
      createStory: async () => {
        throw new Error('Not implemented');
      },
      updateStoryArtifacts: async () => {
        throw new Error('Not implemented');
      },
      getStoryById: async () => ({
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
      }),
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
      listSceneletsByStory: async () => scenelets,
    },
    shotsRepository: {
      createSceneletShots: async () => {
        throw new Error('Not implemented');
      },
      findSceneletIdsMissingShots: async () => [],
      getShotsByStory: async () => shotsByScenelet,
      getShotsBySceneletRef: async () => {
        throw new Error('Not implemented');
      },
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
