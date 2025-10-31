import { describe, expect, it } from 'vitest';

import { assembleKeyFramePrompt } from '../src/shot-image/keyFramePromptAssembler.js';
import { ShotImageTaskError } from '../src/shot-image/errors.js';
import type { ShotRecord, ShotProductionStoryboardEntry } from '../src/shot-production/types.js';
import type { VisualDesignDocument } from '../src/visual-design/types.js';

const VISUAL_DESIGN_DOCUMENT: VisualDesignDocument = {
  global_aesthetic: {
    visual_style: {
      name: 'Neon Noir',
      description: 'High-contrast palette with saturated highlight accents and bold silhouettes.',
    },
    master_color_palette: ['#1B1F3B', '#FF3366', '#38F2FF'],
    style_anchor: 'Electric rain reflected on glossy neon surfaces.',
  },
  character_designs: [
    { character_id: 'rhea', character_name: 'Rhea', key_pose_image_path: '/characters/rhea.png' },
    { character_id: 'testing-agent', character_name: 'Testing Agent', key_pose_image_path: '/characters/testing-agent.png' },
  ],
  environment_designs: [
    { environment_id: 'sandbox-studio', environment_name: 'Sandbox Studio', reference_image_path: '/environments/sandbox.png' },
    { environment_id: 'challenge-bay', environment_name: 'Challenge Bay', reference_image_path: '/environments/challenge.png' },
  ],
};

function createShot(overrides: Partial<ShotProductionStoryboardEntry> = {}): ShotRecord {
  const payload: ShotProductionStoryboardEntry = {
    framingAndAngle: 'Wide shot showcasing the studio and holographic interfaces.',
    compositionAndContent: 'Rhea stands center frame while the Testing Agent orbits, UI panels arcing overhead.',
    characterActionAndEmotion: 'Rhea gestures confidently while the companion orb tilts with keen curiosity.',
    cameraDynamics: 'Slow dolly forward with subtle parallax from floating UI panes.',
    lightingAndAtmosphere: 'Cool blues with magenta accents and volumetric dust motes through beams of light.',
    continuityNotes: "Maintain Rhea's gloves and orb motion path for continuity.",
    referencedDesigns: {
      characters: ['rhea', 'testing-agent'],
      environments: ['sandbox-studio'],
    },
    audioAndNarrative: [
      {
        type: 'monologue',
        source: 'narrator',
        line: 'The studio hums as the plan comes together.',
        delivery: 'Excited and reverent, carrying the thrill of discovery.',
      },
    ],
    ...overrides,
  };

  return {
    sceneletSequence: 1,
    shotIndex: 1,
    storyboardPayload: payload,
    keyFrameImagePath: undefined,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };
}

describe('assembleKeyFramePrompt', () => {
  it('assembles prompt with filtered designs and excludes audio narrative', () => {
    const shot = createShot();

    const prompt = assembleKeyFramePrompt(shot, VISUAL_DESIGN_DOCUMENT);

    expect(prompt.global_aesthetic).toEqual(VISUAL_DESIGN_DOCUMENT.global_aesthetic);
    expect(prompt.character_designs).toHaveLength(2);
    expect(prompt.environment_designs).toHaveLength(1);
    expect(prompt.environment_designs[0]?.environment_id).toBe('sandbox-studio');
    expect(prompt).not.toHaveProperty('audioAndNarrative');
    expect(prompt.referencedDesigns).toEqual({
      characters: ['rhea', 'testing-agent'],
      environments: ['sandbox-studio'],
    });
  });

  it('filters out unreferenced designs', () => {
    const shot = createShot({
      referencedDesigns: { characters: ['rhea'], environments: [] },
    });

    const prompt = assembleKeyFramePrompt(shot, VISUAL_DESIGN_DOCUMENT);

    expect(prompt.character_designs).toHaveLength(1);
    expect(prompt.character_designs[0]?.character_id).toBe('rhea');
    expect(prompt.environment_designs).toEqual([]);
  });

  it('throws when a referenced character design is missing', () => {
    const shot = createShot({
      referencedDesigns: { characters: ['unknown-id'], environments: [] },
    });

    expect(() => assembleKeyFramePrompt(shot, VISUAL_DESIGN_DOCUMENT)).toThrow(
      /character design ids/
    );
  });

  it('throws when a referenced environment design is missing', () => {
    const shot = createShot({
      referencedDesigns: { characters: [], environments: ['missing-env'] },
    });

    expect(() => assembleKeyFramePrompt(shot, VISUAL_DESIGN_DOCUMENT)).toThrow(
      /environment design ids/
    );
  });

  it('throws when global aesthetic fields are missing', () => {
    const shot = createShot();
    const incompleteDoc: VisualDesignDocument = {
      character_designs: VISUAL_DESIGN_DOCUMENT.character_designs,
      environment_designs: VISUAL_DESIGN_DOCUMENT.environment_designs,
    };

    expect(() => assembleKeyFramePrompt(shot, incompleteDoc)).toThrow(/global aesthetic fields/i);
  });

  it('supports legacy documents with top-level visual_style fields', () => {
    const shot = createShot();
    const visualStyle = {
      name: 'Retro Futurism',
    };
    const masterPalette = ['#FFD700', '#1E90FF'];
    const legacyDoc: VisualDesignDocument = {
      visual_style: visualStyle,
      master_color_palette: masterPalette,
      character_designs: VISUAL_DESIGN_DOCUMENT.character_designs,
      environment_designs: VISUAL_DESIGN_DOCUMENT.environment_designs,
    };

    const prompt = assembleKeyFramePrompt(shot, legacyDoc);

    expect(prompt.global_aesthetic).toMatchObject({
      visual_style: visualStyle,
      master_color_palette: masterPalette,
    });
  });
});
