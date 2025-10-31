import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  recommendReferenceImages,
  ReferenceImageRecommenderError,
} from '../src/reference-images/referenceImageRecommender.js';

function createVisualDesignDocument(options: {
  characterPaths?: Record<string, string | null | undefined>;
  environmentPaths?: Record<string, string | null | undefined>;
} = {}) {
  const { characterPaths = {}, environmentPaths = {} } = options;

  return {
    character_designs: Object.entries(characterPaths).map(([characterId, path]) => ({
      character_id: characterId,
      character_model_sheet_image_path: path,
    })),
    environment_designs: Object.entries(environmentPaths).map(([environmentId, path]) => ({
      environment_id: environmentId,
      environment_reference_image_path: path,
    })),
  };
}

const TEST_BASE_PATH = 'tmp/test-reference-images';
const TEST_STORY_ID = 'test-story-123';

describe('recommendReferenceImages', () => {
  beforeEach(() => {
    // Create test directory structure
    if (existsSync(TEST_BASE_PATH)) {
      rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }
    mkdirSync(TEST_BASE_PATH, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_BASE_PATH)) {
      rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }
  });

  it('returns empty array when referencedDesigns is undefined', () => {
    const result = recommendReferenceImages(
      {
        storyId: TEST_STORY_ID,
        referencedDesigns: undefined,
        basePublicPath: TEST_BASE_PATH,
      },
      { validateFileExistence: false }
    );

    expect(result).toEqual([]);
  });

  it('returns empty array when referencedDesigns has no characters or environments', () => {
    const result = recommendReferenceImages(
      {
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: [],
          environments: [],
        },
        basePublicPath: TEST_BASE_PATH,
      },
      { validateFileExistence: false }
    );

    expect(result).toEqual([]);
  });

  it('reads character image paths from visual design document', () => {
    const characterPaths = {
      finn: `${TEST_STORY_ID}/custom/characters/finn/model-sheet.png`,
    };

    const visualDesignDocument = createVisualDesignDocument({ characterPaths });

    const result = recommendReferenceImages(
      {
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: ['finn'],
          environments: [],
        },
        basePublicPath: TEST_BASE_PATH,
        visualDesignDocument,
      },
      { validateFileExistence: false }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'CHARACTER',
      id: 'finn',
    });
    expect(result[0]?.path).toBe(join(TEST_BASE_PATH, characterPaths.finn));
  });

  it('reads environment image paths from visual design document', () => {
    const environmentPaths = {
      hangar: `${TEST_STORY_ID}/custom/environments/hangar/reference.png`,
    };

    const visualDesignDocument = createVisualDesignDocument({ environmentPaths });

    const result = recommendReferenceImages(
      {
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: [],
          environments: ['hangar'],
        },
        basePublicPath: TEST_BASE_PATH,
        visualDesignDocument,
      },
      { validateFileExistence: false }
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'ENVIRONMENT',
      id: 'hangar',
    });
    expect(result[0]?.path).toBe(join(TEST_BASE_PATH, environmentPaths.hangar));
  });

  it('normalizes generated prefix on visual design document paths', () => {
    const environmentPaths = {
      bridge: `generated/${TEST_STORY_ID}/visuals/environments/bridge/reference.png`,
    };

    const visualDesignDocument = createVisualDesignDocument({ environmentPaths });

    const result = recommendReferenceImages(
      {
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: [],
          environments: ['bridge'],
        },
        basePublicPath: TEST_BASE_PATH,
        visualDesignDocument,
      },
      { validateFileExistence: false }
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe(
      join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals/environments/bridge/reference.png')
    );
  });

  it('throws when character path is missing in visual design document', () => {
    const visualDesignDocument = createVisualDesignDocument({
      characterPaths: {
        finn: '',
      },
    });

    expect(() =>
      recommendReferenceImages(
        {
          storyId: TEST_STORY_ID,
          referencedDesigns: {
            characters: ['finn'],
            environments: [],
          },
          basePublicPath: TEST_BASE_PATH,
          visualDesignDocument,
        },
        { validateFileExistence: false }
      )
    ).toThrow(/CREATE_CHARACTER_MODEL_SHEET/);
  });

  it('throws when environment path is missing in visual design document', () => {
    const visualDesignDocument = createVisualDesignDocument({
      environmentPaths: {
        hangar: '   ',
      },
    });

    expect(() =>
      recommendReferenceImages(
        {
          storyId: TEST_STORY_ID,
          referencedDesigns: {
            characters: [],
            environments: ['hangar'],
          },
          basePublicPath: TEST_BASE_PATH,
          visualDesignDocument,
        },
        { validateFileExistence: false }
      )
    ).toThrow(/CREATE_ENVIRONMENT_REFERENCE_IMAGE/);
  });

  it('throws when referenced design is missing from the visual design document', () => {
    const visualDesignDocument = createVisualDesignDocument({
      characterPaths: {
        finn: `${TEST_STORY_ID}/visuals/characters/finn/character-model-sheet.png`,
      },
    });

    expect(() =>
      recommendReferenceImages(
        {
          storyId: TEST_STORY_ID,
          referencedDesigns: {
            characters: ['rhea'],
            environments: [],
          },
          basePublicPath: TEST_BASE_PATH,
          visualDesignDocument,
        },
        { validateFileExistence: false }
      )
    ).toThrow(/visual design document/);
  });

  it('throws when referenced environment is missing from the visual design document', () => {
    const visualDesignDocument = createVisualDesignDocument({
      environmentPaths: {
        bridge: `${TEST_STORY_ID}/visuals/environments/bridge/reference.png`,
      },
    });

    expect(() =>
      recommendReferenceImages(
        {
          storyId: TEST_STORY_ID,
          referencedDesigns: {
            characters: [],
            environments: ['engine-room'],
          },
          basePublicPath: TEST_BASE_PATH,
          visualDesignDocument,
        },
        { validateFileExistence: false }
      )
    ).toThrow(/visual design document/);
  });

  it('throws when file does not exist for visual design document path', () => {
    const characterPaths = {
      finn: `${TEST_STORY_ID}/visuals/characters/finn/custom-model-sheet.png`,
    };

    const visualDesignDocument = createVisualDesignDocument({ characterPaths });

    expect(() =>
      recommendReferenceImages({
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: ['finn'],
          environments: [],
        },
        basePublicPath: TEST_BASE_PATH,
        visualDesignDocument,
      })
    ).toThrow(/custom-model-sheet\.png/);
  });

  it('recommends character model sheets for referenced characters', () => {
    const characterIds = ['finn', 'rhea'];

    // Create mock character model sheet files
    for (const id of characterIds) {
      const dir = join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals', 'characters', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'character-model-sheet-1.png'), 'mock image data');
    }

    const result = recommendReferenceImages({
      storyId: TEST_STORY_ID,
      referencedDesigns: {
        characters: characterIds,
        environments: [],
      },
      basePublicPath: TEST_BASE_PATH,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: 'CHARACTER',
      id: 'finn',
      description: 'Character model sheet for finn',
    });
    expect(result[0]?.path).toContain('character-model-sheet-1.png');
    expect(result[1]).toMatchObject({
      type: 'CHARACTER',
      id: 'rhea',
      description: 'Character model sheet for rhea',
    });
  });

  it('recommends environment keyframes for referenced environments', () => {
    const environmentIds = ['control-room', 'engine-bay'];

    // Create mock environment keyframe files
    for (const id of environmentIds) {
      const dir = join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals', 'environments', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'keyframe_1.png'), 'mock image data');
    }

    const result = recommendReferenceImages({
      storyId: TEST_STORY_ID,
      referencedDesigns: {
        characters: [],
        environments: environmentIds,
      },
      basePublicPath: TEST_BASE_PATH,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: 'ENVIRONMENT',
      id: 'control-room',
      description: 'Environment keyframe for control-room',
    });
    expect(result[0]?.path).toContain('keyframe_1.png');
    expect(result[1]).toMatchObject({
      type: 'ENVIRONMENT',
      id: 'engine-bay',
      description: 'Environment keyframe for engine-bay',
    });
  });

  it('prioritizes characters over environments', () => {
    const characterIds = ['finn', 'rhea'];
    const environmentIds = ['control-room', 'engine-bay'];

    // Create mock files
    for (const id of characterIds) {
      const dir = join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals', 'characters', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'character-model-sheet-1.png'), 'mock image data');
    }
    for (const id of environmentIds) {
      const dir = join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals', 'environments', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'keyframe_1.png'), 'mock image data');
    }

    const result = recommendReferenceImages({
      storyId: TEST_STORY_ID,
      referencedDesigns: {
        characters: characterIds,
        environments: environmentIds,
      },
      basePublicPath: TEST_BASE_PATH,
    });

    expect(result).toHaveLength(4);
    expect(result[0]?.type).toBe('CHARACTER');
    expect(result[1]?.type).toBe('CHARACTER');
    expect(result[2]?.type).toBe('ENVIRONMENT');
    expect(result[3]?.type).toBe('ENVIRONMENT');
  });

  it('limits recommendations to maxImages (default 5)', () => {
    const characterIds = ['char1', 'char2', 'char3', 'char4'];
    const environmentIds = ['env1', 'env2', 'env3'];

    // Create mock files
    for (const id of characterIds) {
      const dir = join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals', 'characters', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'character-model-sheet-1.png'), 'mock image data');
    }
    for (const id of environmentIds) {
      const dir = join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals', 'environments', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'keyframe_1.png'), 'mock image data');
    }

    const result = recommendReferenceImages({
      storyId: TEST_STORY_ID,
      referencedDesigns: {
        characters: characterIds,
        environments: environmentIds,
      },
      basePublicPath: TEST_BASE_PATH,
    });

    // Should limit to 5 total (4 characters + 1 environment)
    expect(result).toHaveLength(5);
    expect(result.filter(r => r.type === 'CHARACTER')).toHaveLength(4);
    expect(result.filter(r => r.type === 'ENVIRONMENT')).toHaveLength(1);
  });

  it('respects custom maxImages parameter', () => {
    const characterIds = ['char1', 'char2', 'char3'];

    // Create mock files
    for (const id of characterIds) {
      const dir = join(TEST_BASE_PATH, TEST_STORY_ID, 'visuals', 'characters', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'character-model-sheet-1.png'), 'mock image data');
    }

    const result = recommendReferenceImages({
      storyId: TEST_STORY_ID,
      referencedDesigns: {
        characters: characterIds,
        environments: [],
      },
      basePublicPath: TEST_BASE_PATH,
      maxImages: 2,
    });

    expect(result).toHaveLength(2);
  });

  it('throws error when character model sheet file does not exist', () => {
    expect(() =>
      recommendReferenceImages({
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: ['missing-character'],
          environments: [],
        },
        basePublicPath: TEST_BASE_PATH,
      })
    ).toThrow(ReferenceImageRecommenderError);

    expect(() =>
      recommendReferenceImages({
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: ['missing-character'],
          environments: [],
        },
        basePublicPath: TEST_BASE_PATH,
      })
    ).toThrow(/Character model sheet not found/);
  });

  it('throws error when environment keyframe file does not exist', () => {
    expect(() =>
      recommendReferenceImages({
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: [],
          environments: ['missing-environment'],
        },
        basePublicPath: TEST_BASE_PATH,
      })
    ).toThrow(ReferenceImageRecommenderError);

    expect(() =>
      recommendReferenceImages({
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: [],
          environments: ['missing-environment'],
        },
        basePublicPath: TEST_BASE_PATH,
      })
    ).toThrow(/Environment keyframe not found/);
  });

  it('skips file existence validation when validateFileExistence is false', () => {
    const result = recommendReferenceImages(
      {
        storyId: TEST_STORY_ID,
        referencedDesigns: {
          characters: ['missing-character'],
          environments: ['missing-environment'],
        },
        basePublicPath: TEST_BASE_PATH,
      },
      { validateFileExistence: false }
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('missing-character');
    expect(result[1]?.id).toBe('missing-environment');
  });

  it('throws error when storyId is empty or invalid', () => {
    expect(() =>
      recommendReferenceImages(
        {
          storyId: '',
          referencedDesigns: { characters: [], environments: [] },
          basePublicPath: TEST_BASE_PATH,
        },
        { validateFileExistence: false }
      )
    ).toThrow(ReferenceImageRecommenderError);

    expect(() =>
      recommendReferenceImages(
        {
          storyId: null as any,
          referencedDesigns: { characters: [], environments: [] },
          basePublicPath: TEST_BASE_PATH,
        },
        { validateFileExistence: false }
      )
    ).toThrow(/storyId must be a non-empty string/);
  });
});
