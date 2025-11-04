import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../src/reference-images/index.js', async () => {
  const actual = (await vi.importActual('../src/reference-images/index.js')) as typeof import('../src/reference-images/index.js');
  return {
    ...actual,
    recommendReferenceImages: vi.fn(),
  };
});

vi.mock('../src/image-generation/index.js', async () => {
  const actual = (await vi.importActual('../src/image-generation/index.js')) as typeof import('../src/image-generation/index.js');
  return {
    ...actual,
    loadReferenceImagesFromPaths: vi.fn(() => []),
  };
});

import { assembleShotVideoPrompt } from '../src/shot-video/promptAssembler.js';
import { selectVideoReferenceImages } from '../src/shot-video/referenceSelector.js';
import { runShotVideoTask } from '../src/shot-video/shotVideoTask.js';
import type { ShotRecord } from '../src/shot-production/types.js';
import type { VisualDesignDocument } from '../src/visual-design/types.js';
import type { AudioDesignDocument } from '../src/audio-design/types.js';
import { ShotVideoTaskError } from '../src/shot-video/errors.js';

const { recommendReferenceImages } = vi.mocked(
  await import('../src/reference-images/index.js')
);
const { loadReferenceImagesFromPaths } = vi.mocked(
  await import('../src/image-generation/index.js')
);

function createShotRecord(overrides: Partial<ShotRecord> = {}): ShotRecord {
  return {
    sceneletRef: overrides.sceneletRef ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sceneletId: overrides.sceneletId ?? 'scenelet-1',
    sceneletSequence: overrides.sceneletSequence ?? 1,
    shotIndex: overrides.shotIndex ?? 1,
    storyboardPayload:
      overrides.storyboardPayload ??
      ({
        framingAndAngle: 'Close up',
        compositionAndContent: 'Two characters talking',
        referencedDesigns: {
          characters: ['hero'],
          environments: ['arena'],
        },
        audioAndNarrative: [
          {
            type: 'monologue',
            source: 'narrator',
            line: 'Our hero faces the challenge.',
            delivery: 'Warm and energetic.',
          },
          {
            type: 'dialogue',
            source: 'hero',
            line: 'I am ready!',
            delivery: 'Confident.',
          },
        ],
      } as any),
    keyFrameImagePath: overrides.keyFrameImagePath,
    videoFilePath: overrides.videoFilePath,
    audioFilePath: overrides.audioFilePath,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2025-01-01T00:00:00.000Z',
  };
}

function createVisualDesignDocument(): VisualDesignDocument {
  return {
    global_aesthetic: {
      visual_style: {
        palette: 'Vibrant neon',
      },
      master_color_palette: ['#ff00ff'],
    },
    character_designs: [
      {
        character_id: 'hero',
        character_name: 'Hero',
        character_model_sheet_image_path: 'story-123/visuals/characters/hero/model-sheet.png',
        costume: 'Armored',
      },
      {
        character_id: 'villain',
        character_name: 'Villain',
        character_model_sheet_image_path: 'story-123/visuals/characters/villain/model-sheet.png',
        costume: 'Cloaked',
      },
    ],
    environment_designs: [
      {
        environment_id: 'arena',
        environment_name: 'Arena',
        environment_reference_image_path: 'story-123/visuals/environments/arena/keyframe.png',
        associated_scenelet_ids: ['scenelet-1'],
      },
    ],
  };
}

function createAudioDesignDocument(): AudioDesignDocument {
  return {
    sonic_identity: {
      musical_direction: 'Synth wave vibe',
      sound_effect_philosophy: 'Punchy foley that emphasizes motion.',
    },
    narrator_voice_profile: {
      character_id: 'narrator',
      voice_name: 'Narrator Prime',
      voice_profile: 'Warm and inviting.',
    },
    character_voice_profiles: [
      {
        character_id: 'hero',
        character_name: 'Hero',
        voice_name: 'Dynamic Hero',
        voice_profile: 'Energetic, confident delivery.',
      },
      {
        character_id: 'villain',
        character_name: 'Villain',
        voice_name: 'Shadow Whisper',
      },
    ],
    music_and_ambience_cues: [],
  };
}

describe('assembleShotVideoPrompt', () => {
  it('builds a structured prompt including storyboard and critical instructions', () => {
    const shot = createShotRecord();
    const visualDesignDocument = createVisualDesignDocument();

    const prompt = assembleShotVideoPrompt(shot, visualDesignDocument, createAudioDesignDocument());

    expect(prompt.global_aesthetic.master_color_palette).toEqual(['#ff00ff']);
    expect(prompt.character_designs).toHaveLength(1);
    expect(prompt.character_designs[0]).not.toHaveProperty('character_model_sheet_image_path');
    expect(prompt.environment_designs).toHaveLength(1);
    expect(prompt.environment_designs[0]).not.toHaveProperty('environment_reference_image_path');
    expect(prompt.environment_designs[0]).not.toHaveProperty('associated_scenelet_ids');
    expect(prompt.audio_design.sonic_identity).toEqual({
      sound_effect_philosophy: 'Punchy foley that emphasizes motion.',
    });
    expect(prompt.audio_design.narrator_voice_profile).toEqual(
      expect.objectContaining({ voice_name: 'Narrator Prime' })
    );
    expect(prompt.audio_design.character_voice_profiles).toHaveLength(1);
    expect(prompt.audio_design.character_voice_profiles[0]).toEqual(
      expect.objectContaining({ character_id: 'hero' })
    );
    expect(prompt.storyboard_payload).toEqual(shot.storyboardPayload);
    expect(prompt.critical_instruction).toEqual([
      'Do not include captions, subtitles, or watermarks.',
      'Do not include background music. Output visuals only.',
    ]);
  });

  it('omits narrator and character profiles when not present in audio narrative', () => {
    const shot = createShotRecord({
      storyboardPayload: {
        framingAndAngle: 'Medium',
        compositionAndContent: 'Two characters talking',
        referencedDesigns: {
          characters: ['hero', 'villain'],
          environments: ['arena'],
        },
        audioAndNarrative: [
          {
            type: 'dialogue',
            source: 'villain',
            line: 'You cannot win.',
            delivery: 'Menacing whisper.',
          },
        ],
      } as any,
    });

    const prompt = assembleShotVideoPrompt(shot, createVisualDesignDocument(), createAudioDesignDocument());

    expect(prompt.audio_design.narrator_voice_profile).toBeUndefined();
    expect(prompt.audio_design.character_voice_profiles).toHaveLength(1);
    expect(prompt.audio_design.character_voice_profiles[0]).toEqual(
      expect.objectContaining({ character_id: 'villain' })
    );
  });

  it('throws when referenced designs are missing', () => {
    const shot = createShotRecord({
      storyboardPayload: {
        framingAndAngle: 'Wide',
      },
    } as any);

    expect(() =>
      assembleShotVideoPrompt(shot, createVisualDesignDocument(), createAudioDesignDocument())
    ).toThrow(ShotVideoTaskError);
  });
});

describe('selectVideoReferenceImages', () => {
  beforeEach(() => {
    recommendReferenceImages.mockReset();
  });

  it('prioritizes characters, then environments, then key frame with dedupe', () => {
    const tempRoot = fs.mkdtempSync(path.join(tmpdir(), 'shot-video-ref-'));
    const keyFrameDir = path.join(tempRoot, 'test-story', 'shots', 'scenelet-1');
    fs.mkdirSync(keyFrameDir, { recursive: true });
    fs.writeFileSync(path.join(keyFrameDir, 'shot-1_key_frame.png'), Buffer.from('stub'));

    const shot = createShotRecord({
      keyFrameImagePath: 'test-story/shots/scenelet-1/shot-1_key_frame.png',
    });
    recommendReferenceImages.mockReturnValue([
      {
        type: 'CHARACTER',
        id: 'hero',
        path: '/tmp/hero.png',
        description: 'hero',
      },
      {
        type: 'CHARACTER',
        id: 'duplicate-hero',
        path: '/tmp/hero.png',
        description: 'duplicate hero',
      },
      {
        type: 'ENVIRONMENT',
        id: 'arena',
        path: '/tmp/arena.png',
        description: 'arena',
      },
    ]);

    const selections = selectVideoReferenceImages({
      storyId: 'test-story',
      shot,
      visualDesignDocument: createVisualDesignDocument(),
      validateFileExistence: false,
      basePublicPath: tempRoot,
    });

    expect(selections).toHaveLength(3);
    expect(selections[0]?.type).toBe('CHARACTER');
    expect(selections[1]?.type).toBe('ENVIRONMENT');
    expect(selections[2]?.type).toBe('KEY_FRAME');

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('runShotVideoTask', () => {
  beforeEach(() => {
    recommendReferenceImages.mockReset();
    loadReferenceImagesFromPaths.mockReset();
    loadReferenceImagesFromPaths.mockReturnValue([
      { data: Buffer.from('image'), mimeType: 'image/png' },
    ]);
  });

  it('runs in dry-run mode without invoking Gemini', async () => {
    recommendReferenceImages.mockReturnValue([
      {
        type: 'CHARACTER',
        id: 'hero',
        path: '/tmp/hero.png',
        description: 'hero',
      },
    ]);

    const shot = createShotRecord();

    const debug = vi.fn();

    const storiesRepository = {
      getStoryById: vi.fn(async () => ({
        id: 'story-123',
        displayName: 'Story',
        initialPrompt: 'Prompt',
        storyConstitution: null,
        visualDesignDocument: createVisualDesignDocument(),
        audioDesignDocument: createAudioDesignDocument(),
        visualReferencePackage: null,
      })),
    };

    const shotsRepository = {
      getShotsByStory: vi.fn(async () => ({
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [shot],
      })),
      getShotsBySceneletRef: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(),
      findShotsMissingImages: vi.fn(),
      findShotsMissingVideos: vi.fn(async () => []),
      createSceneletShots: vi.fn(),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath: vi.fn(),
      updateShotVideoPath: vi.fn(),
    } as any;

    const geminiVideoClient = {
      generateVideo: vi.fn(),
    };

    const videoStorage = {
      saveVideo: vi.fn(),
    };

    const result = await runShotVideoTask('story-123', {
      storiesRepository: storiesRepository as any,
      shotsRepository,
      geminiVideoClient,
      videoStorage,
      dryRun: true,
      verbose: true,
      logger: {
        debug,
      },
    });

    expect(geminiVideoClient.generateVideo).not.toHaveBeenCalled();
    expect(videoStorage.saveVideo).not.toHaveBeenCalled();
    expect(result).toEqual({ generatedVideos: 0, skippedExisting: 0, totalShots: 1 });

    const dryRunLog = debug.mock.calls.find(([message]) => message === 'Dry-run Gemini video request');
    expect(dryRunLog).toBeDefined();
    const [, metadata] = dryRunLog as [string, any];
    expect(metadata.storyId).toBe('story-123');
    expect(metadata.sceneletId).toBe('scenelet-1');
    expect(metadata.request).toBeDefined();
    expect(metadata.request.source.prompt).toEqual(expect.any(String));
    expect(metadata.request.config).toEqual(
      expect.objectContaining({
        numberOfVideos: 1,
      })
    );
    expect(metadata.request.config.referenceImages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          referenceType: 'ASSET',
          image: expect.objectContaining({
            mimeType: 'image/png',
            imageBytes: expect.stringContaining('redacted'),
          }),
        }),
      ])
    );
    expect(metadata.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'hero.png',
          byteLength: Buffer.from('image').length,
          mimeType: 'image/png',
        }),
      ])
    );
  });

  it('generates videos and updates repositories in override mode', async () => {
    recommendReferenceImages.mockReturnValue([
      {
        type: 'CHARACTER',
        id: 'hero',
        path: '/tmp/hero.png',
        description: 'hero',
      },
    ]);

    const shot = createShotRecord();

    const storiesRepository = {
      getStoryById: vi.fn(async () => ({
        id: 'story-123',
        displayName: 'Story',
        initialPrompt: 'Prompt',
        storyConstitution: null,
        visualDesignDocument: createVisualDesignDocument(),
        audioDesignDocument: createAudioDesignDocument(),
        visualReferencePackage: null,
      })),
    };

    const shotsRepository = {
      getShotsByStory: vi.fn(async () => ({
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [shot],
      })),
      getShotsBySceneletRef: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(),
      findShotsMissingImages: vi.fn(),
      findShotsMissingVideos: vi.fn(async () => []),
      createSceneletShots: vi.fn(),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath: vi.fn(),
      updateShotVideoPath: vi.fn(async () => shot),
    } as any;

    const geminiVideoClient = {
      generateVideo: vi.fn(async () => ({
        videoData: Buffer.from('video'),
        mimeType: 'video/mp4',
      })),
    };

    const videoStorage = {
      saveVideo: vi.fn(async () => 'generated/story-123/shots/scenelet-1/shot-1.mp4'),
    };

    const result = await runShotVideoTask('story-123', {
      storiesRepository: storiesRepository as any,
      shotsRepository,
      geminiVideoClient: geminiVideoClient as any,
      videoStorage,
      mode: 'override',
    });

    expect(geminiVideoClient.generateVideo).toHaveBeenCalledTimes(1);
    expect(videoStorage.saveVideo).toHaveBeenCalledWith(
      Buffer.from('video'),
      'story-123',
      'shots/scenelet-1',
      'shot-1.mp4'
    );
    expect(shotsRepository.updateShotVideoPath).toHaveBeenCalledWith(
      'story-123',
      'scenelet-1',
      1,
      'generated/story-123/shots/scenelet-1/shot-1.mp4'
    );
    expect(result).toEqual({ generatedVideos: 1, skippedExisting: 0, totalShots: 1 });
  });

  it('downloads video when videoDownloadLink is provided', async () => {
    const storiesRepository = {
      getStoryById: vi.fn(async () => ({
        id: 'story-123',
        displayName: 'Story',
        initialPrompt: 'Prompt',
        storyConstitution: null,
        visualDesignDocument: createVisualDesignDocument(),
        audioDesignDocument: createAudioDesignDocument(),
        visualReferencePackage: null,
      })),
    };

    const shot = createShotRecord();

    const shotsRepository = {
      getShotsByStory: vi.fn(async () => ({
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [shot],
      })),
      getShotsBySceneletRef: vi.fn(),
      findSceneletIdsMissingShots: vi.fn(),
      findShotsMissingImages: vi.fn(),
      findShotsMissingVideos: vi.fn(async () => []),
      createSceneletShots: vi.fn(),
      updateShotImagePaths: vi.fn(),
      updateShotAudioPath: vi.fn(),
      updateShotVideoPath: vi.fn(async () => shot),
    } as any;

    const geminiVideoClient = {
      generateVideo: vi.fn(),
      downloadVideoByUri: vi.fn(async () => ({
        videoData: Buffer.from('downloaded-video'),
        mimeType: 'video/mp4',
        downloadUri: 'https://example.com/video.mp4',
      })),
    };

    const videoStorage = {
      saveVideo: vi.fn(async () => 'generated/story-123/shots/scenelet-1/shot-1.mp4'),
    };

    const result = await runShotVideoTask('story-123', {
      storiesRepository: storiesRepository as any,
      shotsRepository,
      geminiVideoClient: geminiVideoClient as any,
      videoStorage,
      videoDownloadLink: 'https://example.com/video.mp4',
    });

    expect(geminiVideoClient.downloadVideoByUri).toHaveBeenCalledWith('https://example.com/video.mp4');
    expect(geminiVideoClient.generateVideo).not.toHaveBeenCalled();
    expect(videoStorage.saveVideo).toHaveBeenCalledWith(
      Buffer.from('downloaded-video'),
      'story-123',
      'shots/scenelet-1',
      'shot-1.mp4'
    );
    expect(shotsRepository.updateShotVideoPath).toHaveBeenCalledWith(
      'story-123',
      'scenelet-1',
      1,
      'generated/story-123/shots/scenelet-1/shot-1.mp4'
    );
    expect(result).toEqual({ generatedVideos: 1, skippedExisting: 0, totalShots: 1 });
  });
});
