import "server-only";

import { assembleStoryTreeSnapshot } from "../../../../../agent-backend/src/story-storage/storyTreeAssembler";
import type {
  BranchingPointDigest,
  SceneletDigest,
  StoryTreeEntry,
} from "../../../../../agent-backend/src/story-storage/types";
import { createSceneletsRepository } from "../../../../../supabase/src/sceneletsRepository";
import {
  createStoriesRepository,
  type StoryRecord,
} from "../../../../../supabase/src/storiesRepository";
import { createShotsRepository, type ShotRecord } from "../../../../../supabase/src/shotsRepository";
import type { StoryBundle } from "../../../../../agent-backend/src/bundle/types.js";
import type { SceneletPersistence } from "../../../../../agent-backend/src/interactive-story/types.js";
import { loadEmbeddedStoryBundle } from "../../../../../agent-backend/src/player/embeddedBundle.js";
import { getSupabaseClient } from "../supabase";
import type {
  StoryTreeData,
  StoryboardBranchingPoint,
  StoryboardScenelet,
  ShotImage,
} from "@/components/storyboard/types";
import { normalizeStoragePath } from "@/lib/visualDesignDocument";

export interface StorySummaryViewModel {
  id: string;
  title: string;
  author: string;
  accentColor: string;
  thumbnailImagePath: string | null;
  logline: string | null;
}

export interface StoryDetailViewModel extends StorySummaryViewModel {
  constitutionMarkdown: string | null;
  visualDesignDocument: unknown | null;
  audioDesignDocument: unknown | null;
}

export async function getStoryList(): Promise<StorySummaryViewModel[]> {
  const client = getSupabaseClient();
  const storiesRepository = createStoriesRepository(client);
  const shotsRepository = createShotsRepository(client);
  const stories = await storiesRepository.listStories();

  const enriched = await Promise.all(
    stories.map(async (record, index) => {
      const constitutionMarkdown = extractConstitutionMarkdown(record.storyConstitution);
      const logline = extractLoglineFromMarkdown(constitutionMarkdown);
      const thumbnailImagePath = await findStoryThumbnailImagePath(record.id, shotsRepository);

      return {
        id: record.id,
        title: record.displayName,
        author: DEFAULT_AUTHOR,
        accentColor: deriveAccentColor(record.displayName ?? record.id, index),
        thumbnailImagePath,
        logline,
      } satisfies StorySummaryViewModel;
    })
  );

  return enriched;
}

export async function getStory(storyId: string): Promise<StoryDetailViewModel | null> {
  const trimmed = storyId.trim();
  if (!trimmed) {
    return null;
  }

  const client = getSupabaseClient();
  const storiesRepository = createStoriesRepository(client);
  const shotsRepository = createShotsRepository(client);
  const record = await storiesRepository.getStoryById(trimmed);

  if (!record) {
    return null;
  }

  const constitutionMarkdown = extractConstitutionMarkdown(record.storyConstitution);
  const logline = extractLoglineFromMarkdown(constitutionMarkdown);
  const thumbnailImagePath = await findStoryThumbnailImagePath(trimmed, shotsRepository);

  return mapStoryRecordToDetail(record, {
    constitutionMarkdown,
    logline,
    thumbnailImagePath,
  });
}

export async function getStoryTreeScript(storyId: string): Promise<string | null> {
  const trimmed = storyId.trim();
  if (!trimmed) {
    return null;
  }

  const client = getSupabaseClient();
  const sceneletsRepository = createSceneletsRepository(client);
  const scenelets = await sceneletsRepository.listSceneletsByStory(trimmed);

  if (scenelets.length === 0) {
    return null;
  }

  try {
    const snapshot = assembleStoryTreeSnapshot(scenelets);
    return snapshot.yaml;
  } catch (error) {
    console.error("Failed to assemble story tree snapshot", error);
    return null;
  }
}

export async function getStoryTreeData(storyId: string): Promise<StoryTreeData | null> {
  const trimmed = storyId.trim();
  if (!trimmed) {
    return null;
  }

  const client = getSupabaseClient();
  const sceneletsRepository = createSceneletsRepository(client);
  const shotsRepository = createShotsRepository(client);

  const scenelets = await sceneletsRepository.listSceneletsByStory(trimmed);

  if (scenelets.length === 0) {
    return null;
  }

  try {
    const snapshot = assembleStoryTreeSnapshot(scenelets);
    const shotsByScenelet = await shotsRepository.getShotsByStory(trimmed);
    return mapStoryTreeEntriesToStoryboardData(snapshot.entries, shotsByScenelet);
  } catch (error) {
    console.error("Failed to assemble story tree snapshot", error);
    return null;
  }
}

export async function getEmbeddedStoryBundle(storyId: string): Promise<StoryBundle | null> {
  const trimmed = storyId.trim();
  if (!trimmed) {
    return null;
  }

  const client = getSupabaseClient();
  const storiesRepository = createStoriesRepository(client);
  const sceneletsRepository = createSceneletsRepository(client);
  const shotsRepository = createShotsRepository(client);
  const sceneletPersistence = createReadOnlySceneletPersistence(sceneletsRepository);

  try {
    return await loadEmbeddedStoryBundle(trimmed, {
      storiesRepository,
      sceneletPersistence,
      shotsRepository,
    });
  } catch (error) {
    console.error("Failed to load embedded story bundle", error);
    return null;
  }
}

const DEFAULT_AUTHOR = "Story Tree Agent";
const ACCENT_COLORS = ["#d4a373", "#dfb98e", "#faedcd", "#e9edc9", "#ccd5ae"] as const;

function mapStoryRecordToDetail(
  record: StoryRecord,
  extras: {
    constitutionMarkdown: string | null;
    logline: string | null;
    thumbnailImagePath: string | null;
  }
): StoryDetailViewModel {
  return {
    id: record.id,
    title: record.displayName,
    author: DEFAULT_AUTHOR,
    accentColor: deriveAccentColor(record.displayName ?? record.id),
    constitutionMarkdown: extras.constitutionMarkdown,
    logline: extras.logline,
    thumbnailImagePath: extras.thumbnailImagePath,
    visualDesignDocument: record.visualDesignDocument ?? null,
    audioDesignDocument: record.audioDesignDocument ?? null,
  };
}

function deriveAccentColor(seed: string, fallbackIndex = 0): string {
  if (!seed) {
    return ACCENT_COLORS[fallbackIndex % ACCENT_COLORS.length];
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const normalized = Math.abs(hash) % ACCENT_COLORS.length;
  return ACCENT_COLORS[normalized];
}

function extractConstitutionMarkdown(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const markdown = record.storyConstitutionMarkdown ?? record.story_constitution_markdown;

  if (typeof markdown === "string" && markdown.trim()) {
    return markdown;
  }

  return null;
}

function extractLoglineFromMarkdown(markdown: string | null): string | null {
  if (!markdown) {
    return null;
  }

  const lines = markdown.split(/\r?\n/);
  let inLoglineSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const plainLine = stripMarkdownFormatting(line).trim();
    const normalizedPlain = plainLine.toLowerCase();

    if (!inLoglineSection) {
      if (/^#{1,6}\s+logline\b/i.test(line)) {
        inLoglineSection = true;
        continue;
      }

      const strippedPrefix = stripMarkdownFormatting(line)
        .replace(/^[\d.\-*_()\s]+/, "")
        .trim()
        .toLowerCase();

      if (normalizedPlain === "logline" || normalizedPlain === "logline.") {
        inLoglineSection = true;
        continue;
      }

      if (normalizedPlain.startsWith("logline:")) {
        const inline = stripMarkdownFormatting(line)
          .replace(/^[\d.\-*_()\s]*logline\s*:/i, "")
          .trim();
        if (inline) {
          return stripMarkdownFormatting(inline);
        }
        inLoglineSection = true;
        continue;
      }

      if (strippedPrefix.startsWith("logline:")) {
        const inline = stripMarkdownFormatting(line)
          .replace(/^[\d.\-*_()\s]*logline\s*:/i, "")
          .trim();
        if (inline) {
          return stripMarkdownFormatting(inline);
        }
        inLoglineSection = true;
      }
      continue;
    }

    if (!line) {
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      break;
    }

    if (
      plainLine &&
      /^(\d+(\.\d+)*)[\s).:-]/.test(plainLine) &&
      !normalizedPlain.startsWith("logline")
    ) {
      break;
    }

    const bulletContent = line.replace(/^[-*+]\s+/, "").trim();
    const normalized = stripMarkdownFormatting(bulletContent);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function stripMarkdownFormatting(value: string): string {
  return value
    .replace(/\[(.+?)\]\((.*?)\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\\/g, "")
    .trim();
}

async function findStoryThumbnailImagePath(
  storyId: string,
  shotsRepository: ReturnType<typeof createShotsRepository>
): Promise<string | null> {
  try {
    const shotsByScenelet = await shotsRepository.getShotsByStory(storyId);
    const allShots = Object.values(shotsByScenelet).flat();

    if (allShots.length === 0) {
      return null;
    }

    allShots.sort((a, b) => {
      if (a.sceneletSequence !== b.sceneletSequence) {
        return a.sceneletSequence - b.sceneletSequence;
      }
      return a.shotIndex - b.shotIndex;
    });

    for (const shot of allShots) {
      const normalized = normalizeStoragePath(shot.keyFrameImagePath);
      if (normalized) {
        return normalized;
      }
    }
  } catch (error) {
    console.warn(`Failed to derive thumbnail image for story ${storyId}`, error);
  }

  return null;
}

function createReadOnlySceneletPersistence(
  repository: ReturnType<typeof createSceneletsRepository>
): SceneletPersistence {
  return {
    async createScenelet() {
      throw new Error("createScenelet is not supported by read-only scenelet persistence.");
    },
    async markSceneletAsBranchPoint() {
      throw new Error("markSceneletAsBranchPoint is not supported by read-only scenelet persistence.");
    },
    async markSceneletAsTerminal() {
      throw new Error("markSceneletAsTerminal is not supported by read-only scenelet persistence.");
    },
    hasSceneletsForStory: (targetStoryId) => repository.hasSceneletsForStory(targetStoryId),
    listSceneletsByStory: (targetStoryId) => repository.listSceneletsByStory(targetStoryId),
  } as SceneletPersistence;
}

export function mapStoryTreeEntriesToStoryboardData(
  entries: StoryTreeEntry[],
  shotsByScenelet: Record<string, ShotRecord[]> = {}
): StoryTreeData {
  const shotsBySceneletId = new Map<string, ShotRecord[]>();
  for (const shots of Object.values(shotsByScenelet)) {
    if (!Array.isArray(shots) || shots.length === 0) {
      continue;
    }
    const sceneletId = shots[0]?.sceneletId;
    if (sceneletId) {
      shotsBySceneletId.set(sceneletId, shots);
    }
  }

  const scenelets: StoryboardScenelet[] = [];
  const branchingPoints: StoryboardBranchingPoint[] = [];

  for (const entry of entries) {
    if (entry.kind === "scenelet") {
      const sceneletShots = shotsBySceneletId.get(entry.data.id) ?? [];
      scenelets.push(transformSceneletDigest(entry.data, sceneletShots));
      continue;
    }

    if (entry.kind === "branching-point") {
      branchingPoints.push(transformBranchingPointDigest(entry.data));
    }
  }

  return { scenelets, branchingPoints };
}

function transformSceneletDigest(
  digest: SceneletDigest,
  shots: ShotRecord[] = []
): StoryboardScenelet {
  return {
    id: digest.id,
    parentId: digest.parentId,
    role: digest.role,
    description: digest.description,
    dialogue: digest.dialogue.map((line) => ({ character: line.character, line: line.line })),
    shotSuggestions: [...digest.shotSuggestions],
    shots: shots.map(mapShotRecordToShotImage),
    choiceLabel: digest.choiceLabel ?? null,
  };
}

function transformBranchingPointDigest(digest: BranchingPointDigest): StoryboardBranchingPoint {
  return {
    id: digest.id,
    sourceSceneletId: digest.sourceSceneletId,
    choicePrompt: digest.choicePrompt,
    choices: digest.choices.map((choice) => ({
      label: choice.label,
      leadsTo: choice.leadsTo,
    })),
  };
}

function transformImagePath(dbPath: string | undefined): string | null {
  if (!dbPath) return null;
  const trimmed = dbPath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/generated/')) {
    return trimmed;
  }
  if (trimmed.startsWith('generated/')) {
    return `/${trimmed}`;
  }
  return `/generated/${trimmed}`;
}

function mapShotRecordToShotImage(record: ShotRecord): ShotImage {
  return {
    shotIndex: record.shotIndex,
    keyFrameImagePath: transformImagePath(record.keyFrameImagePath),
    storyboardPayload: record.storyboardPayload,
    createdAt: record.createdAt,
  };
}
