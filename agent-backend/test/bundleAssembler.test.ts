import { describe, expect, it } from 'vitest';

import type { SceneletRecord } from '../../interactive-story/types.js';
import type { ShotRecord } from '../../shot-production/types.js';
import {
  assembleBundleJson,
  buildManifestFromShotMap,
  BundleAssemblyError,
} from '../src/bundle/bundleAssembler.js';
import type {
  AssetManifest,
  BundleAssemblerDependencies,
  BundleLogger,
} from '../src/bundle/types.js';
import { SKIPPED_AUDIO_PLACEHOLDER } from '../src/shot-audio/constants.js';

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

describe('buildManifestFromShotMap', () => {
  it('ignores placeholder audio paths while retaining images', () => {
    const sceneletId = 'scenelet-1';
    const manifest = buildManifestFromShotMap({
      [sceneletId]: [
        createShotRecord({
          sceneletId,
          shotIndex: 1,
          keyFrameImagePath: 'story-1/shots/scenelet-1/shot-1_key_frame.png',
          audioFilePath: SKIPPED_AUDIO_PLACEHOLDER,
        }),
      ],
    });

    const entry = manifest.get(sceneletId)?.get(1);
    expect(entry).toEqual({
      imagePath: 'assets/shots/scenelet-1/1_key_frame.png',
      audioPath: null,
    });
  });

  it('includes music manifest and logs warnings for invalid cue mappings', async () => {
    const storyId = 'music-story';
    const scenelets = [
      createScenelet({ id: 'scenelet-1', storyId }),
      createScenelet({ id: 'scenelet-2', storyId, parentId: 'scenelet-1' }),
      createScenelet({ id: 'scenelet-3', storyId, parentId: 'scenelet-2', isTerminalNode: true }),
    ];

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      'scenelet-1': [
        createShotRecord({
          sceneletId: 'scenelet-1',
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/scenelet-1/shot-1_key_frame.png`,
        }),
      ],
      'scenelet-2': [
        createShotRecord({
          sceneletId: 'scenelet-2',
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/scenelet-2/shot-1_key_frame.png`,
        }),
      ],
      'scenelet-3': [
        createShotRecord({
          sceneletId: 'scenelet-3',
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/scenelet-3/shot-1_key_frame.png`,
        }),
      ],
    };

    const audioDesignDocument = {
      audio_design_document: {
        music_and_ambience_cues: [
          {
            cue_name: 'Cue One',
            associated_scenelet_ids: ['scenelet-1', 'scenelet-2'],
            cue_description: 'First cue',
            music_generation_prompt: 'Play softly',
          },
          {
            cue_name: 'Cue Two',
            associated_scenelet_ids: ['scenelet-3', 'scenelet-5'],
            cue_description: 'Second cue',
            music_generation_prompt: 'Play brightly',
          },
        ],
      },
    };

    const dependencies = makeDependencies({
      storyId,
      scenelets,
      shotsByScenelet,
      audioDesignDocument,
    });

    const warnings: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
    const logger: BundleLogger = {
      warn: (message, metadata) => warnings.push({ message, metadata }),
    };

    const manifest = buildManifestFromShotMap(shotsByScenelet);

    const { bundle } = await assembleBundleJson(storyId, dependencies, {
      assetManifest: manifest,
      preloadedShots: shotsByScenelet,
      exportedAt: ISO_NOW,
      logger,
    });

    expect(bundle.music.cues).toEqual([
      {
        cueName: 'Cue One',
        sceneletIds: ['scenelet-1', 'scenelet-2'],
        audioPath: 'assets/music/Cue One.m4a',
      },
      {
        cueName: 'Cue Two',
        sceneletIds: ['scenelet-3'],
        audioPath: 'assets/music/Cue Two.m4a',
      },
    ]);

    expect(bundle.music.sceneletCueMap).toEqual({
      'scenelet-1': 'Cue One',
      'scenelet-2': 'Cue One',
      'scenelet-3': 'Cue Two',
    });

    expect(warnings.some(({ message }) => message === 'Music cue associated scenelets are not consecutive')).toBe(true);
    expect(warnings.some(({ message, metadata }) => message === 'Music cue references scenelet not present in bundle' && metadata?.sceneletId === 'scenelet-5')).toBe(true);
  });
});

interface DependencyInput {
  storyId: string;
  scenelets: SceneletRecord[];
  shotsByScenelet: Record<string, ShotRecord[]>;
  audioDesignDocument?: unknown;
}

function makeDependencies(input: DependencyInput): BundleAssemblerDependencies {
  const { storyId, scenelets, shotsByScenelet, audioDesignDocument } = input;

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
        audioDesignDocument: audioDesignDocument ?? null,
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
