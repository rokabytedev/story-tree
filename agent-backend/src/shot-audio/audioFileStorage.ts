import { promises as fs } from 'fs';
import path from 'path';

import { ShotAudioTaskError } from './errors.js';
import type {
  AudioFileStorage,
  AudioFileStorageResult,
  SaveBranchAudioOptions,
  SaveShotAudioOptions,
} from './types.js';

export interface FileSystemAudioStorageOptions {
  publicDir?: string;
}

const DEFAULT_PUBLIC_DIR = path.resolve('apps/story-tree-ui/public');

export function createFileSystemAudioStorage(
  options: FileSystemAudioStorageOptions = {}
): AudioFileStorage {
  const publicDir = options.publicDir ? path.resolve(options.publicDir) : DEFAULT_PUBLIC_DIR;

  return {
    async saveShotAudio(request: SaveShotAudioOptions): Promise<AudioFileStorageResult> {
      const storyId = normalizeSegment('storyId', request.storyId);
      const sceneletId = normalizeSegment('sceneletId', request.sceneletId);
      const shotIndex = request.shotIndex;

      if (!Number.isInteger(shotIndex) || shotIndex <= 0) {
        throw new ShotAudioTaskError('shotIndex must be a positive integer to store audio.');
      }

      if (!Buffer.isBuffer(request.audioData) || request.audioData.length === 0) {
        throw new ShotAudioTaskError('audioData must be a non-empty Buffer.');
      }

      const relativePath = path.posix.join(
        'generated',
        storyId,
        'shots',
        sceneletId,
        `${shotIndex}_audio.wav`
      );

      const absolutePath = path.join(publicDir, relativePath);
      const directory = path.dirname(absolutePath);

      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(absolutePath, request.audioData);

      return {
        relativePath,
        absolutePath,
      };
    },

    async saveBranchAudio(request: SaveBranchAudioOptions): Promise<AudioFileStorageResult> {
      const storyId = normalizeSegment('storyId', request.storyId);
      const sceneletId = normalizeSegment('sceneletId', request.sceneletId);

      if (!Buffer.isBuffer(request.audioData) || request.audioData.length === 0) {
        throw new ShotAudioTaskError('audioData must be a non-empty Buffer.');
      }

      const relativePath = path.posix.join(
        'generated',
        storyId,
        'branches',
        sceneletId,
        'branch_audio.wav'
      );

      const absolutePath = path.join(publicDir, relativePath);
      const directory = path.dirname(absolutePath);

      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(absolutePath, request.audioData);

      return {
        relativePath,
        absolutePath,
      };
    },
  };
}

function normalizeSegment(field: string, value: string): string {
  const trimmed = value?.trim?.();
  if (!trimmed) {
    throw new ShotAudioTaskError(`${field} is required to store audio.`);
  }

  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new ShotAudioTaskError(`${field} contains invalid path characters.`);
  }

  return trimmed;
}
