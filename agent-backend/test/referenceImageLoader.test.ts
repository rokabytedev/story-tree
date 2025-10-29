import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createReferenceImageLoader } from '../src/shot-image/referenceImageLoader.js';
import { ShotImageTaskError } from '../src/shot-image/errors.js';

describe('createReferenceImageLoader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ref-image-loader-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createTestStructure(storyId: string, characterName: string, imageCount: number) {
    const characterDir = path.join(tempDir, storyId, 'visuals/characters', characterName);
    await fs.mkdir(characterDir, { recursive: true });

    const imagePaths: string[] = [];
    for (let i = 1; i <= imageCount; i++) {
      const imagePath = path.join(characterDir, `image_${i}.png`);
      await fs.writeFile(imagePath, Buffer.from(`fake-image-${i}`));
      imagePaths.push(imagePath);
    }

    return imagePaths;
  }

  it('loads character reference images from filesystem', async () => {
    await createTestStructure('story-123', 'cosmo-the-coder', 3);

    const loader = createReferenceImageLoader({ baseDir: tempDir });
    const result = await loader.loadCharacterReferences('story-123', ['Cosmo the Coder'], 3);

    expect(result.size).toBe(1);
    expect(result.get('Cosmo the Coder')).toHaveLength(3);
    expect(result.get('Cosmo the Coder')?.[0]).toContain('image_1.png');
  });

  it('limits number of images returned per character', async () => {
    await createTestStructure('story-123', 'alice', 5);

    const loader = createReferenceImageLoader({ baseDir: tempDir });
    const result = await loader.loadCharacterReferences('story-123', ['Alice'], 2);

    expect(result.get('Alice')).toHaveLength(2);
  });

  it('loads images for multiple characters', async () => {
    await createTestStructure('story-123', 'alice', 2);
    await createTestStructure('story-123', 'bob', 3);

    const loader = createReferenceImageLoader({ baseDir: tempDir });
    const result = await loader.loadCharacterReferences('story-123', ['Alice', 'Bob'], 3);

    expect(result.size).toBe(2);
    expect(result.get('Alice')).toHaveLength(2);
    expect(result.get('Bob')).toHaveLength(3);
  });

  it('filters non-image files', async () => {
    const characterDir = path.join(tempDir, 'story-123/visuals/characters/alice');
    await fs.mkdir(characterDir, { recursive: true });
    await fs.writeFile(path.join(characterDir, 'image.png'), Buffer.from('image'));
    await fs.writeFile(path.join(characterDir, 'data.json'), Buffer.from('{}'));
    await fs.writeFile(path.join(characterDir, 'readme.txt'), Buffer.from('info'));

    const loader = createReferenceImageLoader({ baseDir: tempDir });
    const result = await loader.loadCharacterReferences('story-123', ['Alice'], 10);

    expect(result.get('Alice')).toHaveLength(1);
    expect(result.get('Alice')?.[0]).toContain('image.png');
  });

  it('throws when character directory does not exist', async () => {
    const loader = createReferenceImageLoader({ baseDir: tempDir });

    await expect(
      loader.loadCharacterReferences('story-123', ['NonExistent'], 3)
    ).rejects.toBeInstanceOf(ShotImageTaskError);
  });

  it('throws when character directory has no images', async () => {
    const characterDir = path.join(tempDir, 'story-123/visuals/characters/alice');
    await fs.mkdir(characterDir, { recursive: true });
    await fs.writeFile(path.join(characterDir, 'readme.txt'), Buffer.from('no images'));

    const loader = createReferenceImageLoader({ baseDir: tempDir });

    await expect(
      loader.loadCharacterReferences('story-123', ['Alice'], 3)
    ).rejects.toBeInstanceOf(ShotImageTaskError);
  });
});
