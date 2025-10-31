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
import { getSupabaseClient } from "../supabase";
import type {
  StoryTreeData,
  StoryboardBranchingPoint,
  StoryboardScenelet,
  ShotImage,
} from "@/components/storyboard/types";

export interface StorySummaryViewModel {
  id: string;
  title: string;
  author: string;
  accentColor: string;
}

export interface StoryDetailViewModel extends StorySummaryViewModel {
  constitutionMarkdown: string | null;
  visualDesignDocument: unknown | null;
  visualReferencePackage: unknown | null;
  audioDesignDocument: unknown | null;
}

export async function getStoryList(): Promise<StorySummaryViewModel[]> {
  const client = getSupabaseClient();
  const storiesRepository = createStoriesRepository(client);
  const stories = await storiesRepository.listStories();

  return stories.map((record, index) => ({
    id: record.id,
    title: record.displayName,
    author: DEFAULT_AUTHOR,
    accentColor: deriveAccentColor(record.displayName ?? record.id, index),
  }));
}

export async function getStory(storyId: string): Promise<StoryDetailViewModel | null> {
  const trimmed = storyId.trim();
  if (!trimmed) {
    return null;
  }

  const client = getSupabaseClient();
  const storiesRepository = createStoriesRepository(client);
  const record = await storiesRepository.getStoryById(trimmed);

  if (!record) {
    return null;
  }

  return mapStoryRecordToDetail(record);
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

const DEFAULT_AUTHOR = "Story Tree Agent";
const ACCENT_COLORS = ["#6366f1", "#0ea5e9", "#f97316", "#f43f5e", "#22c55e", "#a855f7"] as const;

function mapStoryRecordToDetail(record: StoryRecord): StoryDetailViewModel {
  return {
    id: record.id,
    title: record.displayName,
    author: DEFAULT_AUTHOR,
    accentColor: deriveAccentColor(record.displayName ?? record.id),
    constitutionMarkdown: extractConstitutionMarkdown(record.storyConstitution),
    visualDesignDocument: record.visualDesignDocument ?? null,
    visualReferencePackage: record.visualReferencePackage ?? null,
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

export function mapStoryTreeEntriesToStoryboardData(
  entries: StoryTreeEntry[],
  shotsByScenelet: Record<string, ShotRecord[]> = {}
): StoryTreeData {
  const scenelets: StoryboardScenelet[] = [];
  const branchingPoints: StoryboardBranchingPoint[] = [];

  for (const entry of entries) {
    if (entry.kind === "scenelet") {
      const sceneletShots = shotsByScenelet[entry.data.id] ?? [];
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
