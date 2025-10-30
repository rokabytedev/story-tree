import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadReferenceImagesFromPaths,
  ReferenceImageLoadError,
} from '../src/image-generation/referenceImageLoader.js';

const TEST_DIR = 'tmp/test-image-gen-reference-loader';

describe('loadReferenceImagesFromPaths', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('loads PNG images from file paths', () => {
    const imagePath = join(TEST_DIR, 'test-image.png');
    const imageData = Buffer.from('mock PNG data');
    writeFileSync(imagePath, imageData);

    const result = loadReferenceImagesFromPaths([imagePath]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      mimeType: 'image/png',
    });
    expect(result[0]?.data.toString()).toBe(imageData.toString());
  });

  it('loads JPEG images from file paths', () => {
    const jpgPath = join(TEST_DIR, 'test-image.jpg');
    const jpegPath = join(TEST_DIR, 'test-image.jpeg');
    const imageData = Buffer.from('mock JPEG data');
    writeFileSync(jpgPath, imageData);
    writeFileSync(jpegPath, imageData);

    const result = loadReferenceImagesFromPaths([jpgPath, jpegPath]);

    expect(result).toHaveLength(2);
    expect(result[0]?.mimeType).toBe('image/jpeg');
    expect(result[1]?.mimeType).toBe('image/jpeg');
  });

  it('loads multiple images from file paths', () => {
    const paths = [
      join(TEST_DIR, 'image1.png'),
      join(TEST_DIR, 'image2.jpg'),
      join(TEST_DIR, 'image3.jpeg'),
    ];

    for (const path of paths) {
      writeFileSync(path, Buffer.from('mock image data'));
    }

    const result = loadReferenceImagesFromPaths(paths);

    expect(result).toHaveLength(3);
    expect(result[0]?.mimeType).toBe('image/png');
    expect(result[1]?.mimeType).toBe('image/jpeg');
    expect(result[2]?.mimeType).toBe('image/jpeg');
  });

  it('throws error when file does not exist', () => {
    const missingPath = join(TEST_DIR, 'missing.png');

    expect(() => loadReferenceImagesFromPaths([missingPath])).toThrow(ReferenceImageLoadError);
    expect(() => loadReferenceImagesFromPaths([missingPath])).toThrow(/not found/);
  });

  it('throws error for unsupported file format', () => {
    const unsupportedPath = join(TEST_DIR, 'image.gif');
    writeFileSync(unsupportedPath, Buffer.from('mock GIF data'));

    expect(() => loadReferenceImagesFromPaths([unsupportedPath])).toThrow(ReferenceImageLoadError);
    expect(() => loadReferenceImagesFromPaths([unsupportedPath])).toThrow(/Unsupported reference image format/);
  });

  it('throws error when file is empty', () => {
    const emptyPath = join(TEST_DIR, 'empty.png');
    writeFileSync(emptyPath, Buffer.alloc(0));

    expect(() => loadReferenceImagesFromPaths([emptyPath])).toThrow(ReferenceImageLoadError);
    expect(() => loadReferenceImagesFromPaths([emptyPath])).toThrow(/empty/);
  });

  it('returns empty array for empty path array', () => {
    const result = loadReferenceImagesFromPaths([]);
    expect(result).toEqual([]);
  });

  it('handles mixed case file extensions', () => {
    const paths = [
      join(TEST_DIR, 'image.PNG'),
      join(TEST_DIR, 'image.JPG'),
      join(TEST_DIR, 'image.JPEG'),
    ];

    for (const path of paths) {
      writeFileSync(path, Buffer.from('mock image data'));
    }

    const result = loadReferenceImagesFromPaths(paths);

    expect(result).toHaveLength(3);
    expect(result[0]?.mimeType).toBe('image/png');
    expect(result[1]?.mimeType).toBe('image/jpeg');
    expect(result[2]?.mimeType).toBe('image/jpeg');
  });
});
