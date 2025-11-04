import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { SceneletRecord } from '../src/interactive-story/types.js';
import type { ShotRecord } from '../../shot-production/types.js';
import { SKIPPED_AUDIO_PLACEHOLDER } from '../src/shot-audio/constants.js';
import { copyAssets } from '../src/bundle/assetCopier.js';

const TMP_PREFIX = 'asset-copier-test-';

function createShotRecord(overrides: Partial<ShotRecord> = {}): ShotRecord {
  return {
    sceneletSequence: overrides.sceneletSequence ?? 1,
    shotIndex: overrides.shotIndex ?? 1,
    storyboardPayload: overrides.storyboardPayload ?? {},
    keyFrameImagePath: overrides.keyFrameImagePath,
    videoFilePath: overrides.videoFilePath,
    audioFilePath: overrides.audioFilePath,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

function createSceneletRecord(overrides: Partial<SceneletRecord> = {}): SceneletRecord {
  const id = overrides.id ?? 'scenelet-1';
  return {
    id,
    storyId: overrides.storyId ?? 'story-123',
    parentId: overrides.parentId ?? null,
    choiceLabelFromParent: overrides.choiceLabelFromParent ?? null,
    choicePrompt: overrides.choicePrompt ?? null,
    branchAudioFilePath: overrides.branchAudioFilePath,
    content:
      overrides.content ?? {
        description: `Scenelet ${id}`,
        dialogue: [],
        shot_suggestions: [],
      },
    isBranchPoint: overrides.isBranchPoint ?? false,
    isTerminalNode: overrides.isTerminalNode ?? false,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
}

describe('copyAssets', () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    while (tempRoots.length) {
      const dir = tempRoots.pop();
      if (dir) {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('copies available image and audio assets and returns manifest entries', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const generatedRoot = path.join(root, 'generated');
    const storyId = 'story-123';
    const sceneletId = 'scenelet-root';
    const shotsDir = path.join(generatedRoot, storyId, 'shots', sceneletId);

    await fs.mkdir(shotsDir, { recursive: true });
    const imageSource = path.join(shotsDir, 'shot-1_key_frame.png');
    const audioSource = path.join(shotsDir, '1_audio.wav');
    await fs.writeFile(imageSource, Buffer.from('image-data'));
    await fs.writeFile(audioSource, Buffer.from('audio-data'));

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      [sceneletId]: [
        createShotRecord({
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/${sceneletId}/shot-1_key_frame.png`,
          audioFilePath: `generated/${storyId}/shots/${sceneletId}/1_audio.wav`,
        }),
      ],
    };

    const outputRoot = path.join(root, 'output');

    const manifest = await copyAssets(storyId, shotsByScenelet, outputRoot, {
      generatedAssetsRoot: generatedRoot,
    });

    expect(manifest.size).toBe(1);
    const sceneletManifest = manifest.get(sceneletId);
    expect(sceneletManifest?.shots.get(1)).toEqual({
      imagePath: `assets/shots/${sceneletId}/1_key_frame.png`,
      audioPath: `assets/shots/${sceneletId}/1_audio.wav`,
    });
    expect(sceneletManifest?.branchAudioPath).toBeNull();

    const targetImage = path.join(outputRoot, storyId, 'assets', 'shots', sceneletId, '1_key_frame.png');
    const targetAudio = path.join(outputRoot, storyId, 'assets', 'shots', sceneletId, '1_audio.wav');

    await expect(fs.stat(targetImage)).resolves.toBeDefined();
    await expect(fs.stat(targetAudio)).resolves.toBeDefined();
  });

  it('logs warning and omits missing image while preserving audio', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const generatedRoot = path.join(root, 'generated');
    const storyId = 'story-456';
    const sceneletId = 'scenelet-branch';
    const shotsDir = path.join(generatedRoot, storyId, 'shots', sceneletId);

    await fs.mkdir(shotsDir, { recursive: true });
    const audioSource = path.join(shotsDir, '2_audio.wav');
    await fs.writeFile(audioSource, Buffer.from('audio-data'));

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      [sceneletId]: [
        createShotRecord({
          shotIndex: 2,
          keyFrameImagePath: `${storyId}/shots/${sceneletId}/shot-2_key_frame.png`,
          audioFilePath: `generated/${storyId}/shots/${sceneletId}/2_audio.wav`,
        }),
      ],
    };

    const outputRoot = path.join(root, 'output');
    const warn = vi.fn();

    const manifest = await copyAssets(storyId, shotsByScenelet, outputRoot, {
      generatedAssetsRoot: generatedRoot,
      logger: { warn },
    });

    expect(warn).toHaveBeenCalledWith('Missing shot image for bundle', expect.any(Object));
    const sceneletManifest = manifest.get(sceneletId);
    expect(sceneletManifest?.shots.get(2)).toEqual({
      imagePath: null,
      audioPath: `assets/shots/${sceneletId}/2_audio.wav`,
    });
    expect(sceneletManifest?.branchAudioPath).toBeNull();

    const targetAudio = path.join(outputRoot, storyId, 'assets', 'shots', sceneletId, '2_audio.wav');
    await expect(fs.stat(targetAudio)).resolves.toBeDefined();
  });

  it('skips shots with no available assets', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const storyId = 'story-empty';
    const sceneletId = 'no-assets';
    const shotsByScenelet: Record<string, ShotRecord[]> = {
      [sceneletId]: [
        createShotRecord({
          shotIndex: 1,
          keyFrameImagePath: null,
          audioFilePath: null,
        }),
      ],
    };

    const manifest = await copyAssets(storyId, shotsByScenelet, path.join(root, 'output'), {
      generatedAssetsRoot: path.join(root, 'generated'),
    });

    expect(manifest.size).toBe(0);
  });

  it('omits placeholder audio paths from manifest and copy operations', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const generatedRoot = path.join(root, 'generated');
    const storyId = 'story-placeholder';
    const sceneletId = 'scenelet-gap';
    const shotsDir = path.join(generatedRoot, storyId, 'shots', sceneletId);

    await fs.mkdir(shotsDir, { recursive: true });
    const imageSource = path.join(shotsDir, 'shot-1_key_frame.png');
    await fs.writeFile(imageSource, Buffer.from('image-data'));

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      [sceneletId]: [
        createShotRecord({
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/${sceneletId}/shot-1_key_frame.png`,
          audioFilePath: SKIPPED_AUDIO_PLACEHOLDER,
        }),
      ],
    };

    const outputRoot = path.join(root, 'output');
    const warn = vi.fn();

    const manifest = await copyAssets(storyId, shotsByScenelet, outputRoot, {
      generatedAssetsRoot: generatedRoot,
      logger: { warn },
    });

    const sceneletManifest = manifest.get(sceneletId);
    expect(sceneletManifest?.shots.get(1)).toEqual({
      imagePath: `assets/shots/${sceneletId}/1_key_frame.png`,
      audioPath: null,
    });
    expect(sceneletManifest?.branchAudioPath).toBeNull();

    const targetImage = path.join(outputRoot, storyId, 'assets', 'shots', sceneletId, '1_key_frame.png');
    await expect(fs.stat(targetImage)).resolves.toBeDefined();

    const targetAudio = path.join(outputRoot, storyId, 'assets', 'shots', sceneletId, '1_audio.wav');
    await expect(fs.stat(targetAudio)).rejects.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('copies branch audio assets when branch paths are provided', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const generatedRoot = path.join(root, 'generated');
    const storyId = 'story-branch';
    const sceneletId = 'branch-scenelet';

    const shotsDir = path.join(generatedRoot, storyId, 'shots', sceneletId);
    await fs.mkdir(shotsDir, { recursive: true });
    await fs.writeFile(path.join(shotsDir, 'shot-1_key_frame.png'), Buffer.from('image-data'));

    const branchDir = path.join(generatedRoot, storyId, 'branches', sceneletId);
    await fs.mkdir(branchDir, { recursive: true });
    await fs.writeFile(path.join(branchDir, 'branch_audio.wav'), Buffer.from('branch-audio'));

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      [sceneletId]: [
        createShotRecord({
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/${sceneletId}/shot-1_key_frame.png`,
        }),
      ],
    };

    const scenelets = [
      createSceneletRecord({
        id: sceneletId,
        storyId,
        branchAudioFilePath: `generated/${storyId}/branches/${sceneletId}/branch_audio.wav`,
      }),
    ];

    const outputRoot = path.join(root, 'output');

    const manifest = await copyAssets(storyId, shotsByScenelet, outputRoot, {
      generatedAssetsRoot: generatedRoot,
      scenelets,
    });

    const entry = manifest.get(sceneletId);
    expect(entry?.branchAudioPath).toBe(`assets/branches/${sceneletId}/branch_audio.wav`);
    expect(entry?.shots.get(1)?.imagePath).toBe(`assets/shots/${sceneletId}/1_key_frame.png`);

    const branchTarget = path.join(
      outputRoot,
      storyId,
      'assets',
      'branches',
      sceneletId,
      'branch_audio.wav'
    );
    await expect(fs.stat(branchTarget)).resolves.toBeDefined();
  });

  it('logs a warning when branch audio source is missing and omits the path', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const generatedRoot = path.join(root, 'generated');
    const storyId = 'story-missing-branch';
    const sceneletId = 'scenelet-missing-branch';

    const shotsDir = path.join(generatedRoot, storyId, 'shots', sceneletId);
    await fs.mkdir(shotsDir, { recursive: true });
    await fs.writeFile(path.join(shotsDir, 'shot-1_key_frame.png'), Buffer.from('image-data'));

    const shotsByScenelet: Record<string, ShotRecord[]> = {
      [sceneletId]: [
        createShotRecord({
          shotIndex: 1,
          keyFrameImagePath: `${storyId}/shots/${sceneletId}/shot-1_key_frame.png`,
        }),
      ],
    };

    const scenelets = [
      createSceneletRecord({
        id: sceneletId,
        storyId,
        branchAudioFilePath: `generated/${storyId}/branches/${sceneletId}/branch_audio.wav`,
      }),
    ];

    const outputRoot = path.join(root, 'output');
    const warn = vi.fn();

    const manifest = await copyAssets(storyId, shotsByScenelet, outputRoot, {
      generatedAssetsRoot: generatedRoot,
      scenelets,
      logger: { warn },
    });

    const entry = manifest.get(sceneletId);
    expect(entry?.branchAudioPath).toBeNull();
    expect(warn).toHaveBeenCalledWith('Missing branch audio for bundle', expect.any(Object));
  });

  it('copies music cue assets referenced in the audio design document', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const generatedRoot = path.join(root, 'generated');
    const storyId = 'story-music';
    const musicDir = path.join(generatedRoot, storyId, 'music');
    await fs.mkdir(musicDir, { recursive: true });
    const cueSource = path.join(musicDir, 'Cue One.m4a');
    await fs.writeFile(cueSource, Buffer.from('music-data'));

    const audioDesignDocument = {
      audio_design_document: {
        music_and_ambience_cues: [
          {
            cue_name: 'Cue One',
            associated_scenelet_ids: ['scenelet-1'],
            cue_description: 'Primary cue',
            music_generation_prompt: 'Prompt',
          },
          {
            cue_name: 'Cue One',
            associated_scenelet_ids: ['scenelet-2'],
            cue_description: 'Duplicate entry to test dedupe',
            music_generation_prompt: 'Prompt',
          },
        ],
      },
    };

    const outputRoot = path.join(root, 'output');

    const manifest = await copyAssets(storyId, {}, outputRoot, {
      generatedAssetsRoot: generatedRoot,
      audioDesignDocument,
    });

    expect(manifest.size).toBe(0);

    const targetCue = path.join(outputRoot, storyId, 'assets', 'music', 'Cue One.m4a');
    await expect(fs.stat(targetCue)).resolves.toBeDefined();
  });

  it('logs warning when a referenced music cue asset is missing', async () => {
    const root = await createTempRoot();
    tempRoots.push(root);

    const generatedRoot = path.join(root, 'generated');
    const storyId = 'story-missing-music';

    const audioDesignDocument = {
      audio_design_document: {
        music_and_ambience_cues: [
          {
            cue_name: 'Missing Cue',
            associated_scenelet_ids: ['scenelet-9'],
            cue_description: 'Missing asset test',
            music_generation_prompt: 'Prompt',
          },
        ],
      },
    };

    const warn = vi.fn();

    await copyAssets(storyId, {}, path.join(root, 'output'), {
      generatedAssetsRoot: generatedRoot,
      audioDesignDocument,
      logger: { warn },
    });

    expect(warn).toHaveBeenCalledWith('Missing music cue asset for bundle', expect.objectContaining({
      storyId,
      cueName: 'Missing Cue',
    }));
  });
});
