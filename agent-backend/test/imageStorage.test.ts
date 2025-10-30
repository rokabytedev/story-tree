import * as fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageStorageService } from '../src/image-generation/imageStorage.js';

const { mkdtemp, readFile, rm } = fsPromises;

describe('ImageStorageService', () => {
  let tempRoot: string;
  let service: ImageStorageService;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'image-storage-'));
    service = new ImageStorageService({ publicGeneratedRoot: tempRoot });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('saves image buffers under the story-generated directory and returns relative path', async () => {
    const buffer = Buffer.from('test-image-data');

    const relativePath = await service.saveImage(buffer, 'story-123', 'shots', 'scenelet-1.png');

    expect(relativePath).toBe('story-123/shots/scenelet-1.png');

    const stored = await readFile(path.join(tempRoot, 'story-123', 'shots', 'scenelet-1.png'));
    expect(stored.equals(buffer)).toBe(true);
  });

  it('supports nested category segments when saving images', async () => {
    const buffer = Buffer.from('nested-image-data');

    const relativePath = await service.saveImage(
      buffer,
      'story-456',
      'visuals/characters/cosmo-the-coder',
      'model_sheet_1.png'
    );

    expect(relativePath).toBe('story-456/visuals/characters/cosmo-the-coder/model_sheet_1.png');

    const stored = await readFile(
      path.join(tempRoot, 'story-456', 'visuals', 'characters', 'cosmo-the-coder', 'model_sheet_1.png')
    );
    expect(stored.equals(buffer)).toBe(true);
  });

  it('rejects filenames with path traversal characters', async () => {
    await expect(
      service.saveImage(Buffer.from('test'), 'story-123', 'shots', '../scenelet.png'),
    ).rejects.toThrowError('Filename contains invalid path characters.');
  });

  it('wraps permission errors with descriptive messages', async () => {
    const permissionError = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const mkdirMock = vi.fn().mockResolvedValue(undefined);
    const writeFileMock = vi.fn().mockRejectedValue(permissionError);
    const failingService = new ImageStorageService(
      { publicGeneratedRoot: tempRoot },
      { fileSystem: { mkdir: mkdirMock, writeFile: writeFileMock } },
    );

    await expect(failingService.saveImage(Buffer.from('test'), 'story-123', 'shots', 'frame.png')).rejects.toThrowError(
      /Unable to save image to .*frame\.png: permission denied/u,
    );

    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
  });
});
