import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

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
    audioFilePath: overrides.audioFilePath,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
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
    expect(sceneletManifest?.get(1)).toEqual({
      imagePath: `assets/shots/${sceneletId}/1_key_frame.png`,
      audioPath: `assets/shots/${sceneletId}/1_audio.wav`,
    });

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
    expect(sceneletManifest?.get(2)).toEqual({
      imagePath: null,
      audioPath: `assets/shots/${sceneletId}/2_audio.wav`,
    });

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
    expect(sceneletManifest?.get(1)).toEqual({
      imagePath: `assets/shots/${sceneletId}/1_key_frame.png`,
      audioPath: null,
    });

    const targetImage = path.join(outputRoot, storyId, 'assets', 'shots', sceneletId, '1_key_frame.png');
    await expect(fs.stat(targetImage)).resolves.toBeDefined();

    const targetAudio = path.join(outputRoot, storyId, 'assets', 'shots', sceneletId, '1_audio.wav');
    await expect(fs.stat(targetAudio)).rejects.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
