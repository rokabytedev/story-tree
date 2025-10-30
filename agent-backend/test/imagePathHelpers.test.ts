import { describe, expect, it } from 'vitest';

import {
  buildShotImagePath,
  buildVisualReferencePath,
  validateImagePath,
} from '../src/storage/imagePathHelpers.js';

describe('buildVisualReferencePath', () => {
  it('creates normalized character model sheet paths', () => {
    const path = buildVisualReferencePath('story-123', 'characters', 'Cosmo the Coder', 1);
    expect(path).toBe('story-123/visuals/characters/cosmo-the-coder/model_sheet_1.png');
  });

  it('creates normalized environment keyframe paths', () => {
    const path = buildVisualReferencePath('story-123', 'environments', 'Jungle Workshop', 2);
    expect(path).toBe('story-123/visuals/environments/jungle-workshop/keyframe_2.png');
  });

  it('throws when the index is not a positive integer', () => {
    expect(() => buildVisualReferencePath('story-123', 'characters', 'Name', 0)).toThrowError(
      'Image index must be a positive integer.',
    );
  });
});

describe('buildShotImagePath', () => {
  it('creates first frame paths with sanitized identifiers', () => {
    const path = buildShotImagePath('story-abc', 'scenelet-1', 3, 'first_frame');
    expect(path).toBe('story-abc/shots/scenelet-1_shot_3_first_frame.png');
  });

  it('creates key frame paths', () => {
    const path = buildShotImagePath('story-abc', 'scenelet-2', 4, 'key_frame');
    expect(path).toBe('story-abc/shots/scenelet-2_shot_4_key_frame.png');
  });

  it('rejects unsafe scenelet identifiers', () => {
    expect(() => buildShotImagePath('story-abc', 'scenelet/../../../evil', 1, 'first_frame')).toThrowError(
      'Scenelet ID contains invalid path characters.',
    );
  });

  it('rejects invalid frame types', () => {
    expect(() => buildShotImagePath('story-abc', 'scenelet-1', 1, 'middle_frame' as never)).toThrowError(
      'Frame type must be "first_frame" or "key_frame".',
    );
  });
});

describe('validateImagePath', () => {
  it('accepts valid relative paths', () => {
    expect(validateImagePath('story-123/shots/scenelet-1_shot_1_first_frame.png')).toBeUndefined();
  });

  it('rejects paths with traversal segments', () => {
    expect(() => validateImagePath('story-123/../evil.png')).toThrowError('Image path contains invalid segments.');
  });

  it('rejects absolute paths', () => {
    expect(() => validateImagePath('/absolute/path.png')).toThrowError('Image path must be relative.');
    expect(() => validateImagePath('C:\\temp\\image.png')).toThrowError('Image path must be relative.');
  });

  it('rejects invalid story identifiers', () => {
    expect(() => validateImagePath('invalid story/shots/frame.png')).toThrowError(
      'Image path must start with a valid story identifier.',
    );
  });
});
