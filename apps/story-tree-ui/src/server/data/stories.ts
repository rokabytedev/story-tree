import "server-only";

import { assembleStoryTreeSnapshot } from "../../../../../agent-backend/src/story-storage/storyTreeAssembler";
import { createSceneletsRepository } from "../../../../../supabase/src/sceneletsRepository";
import {
  createStoriesRepository,
  type StoryRecord,
} from "../../../../../supabase/src/storiesRepository";
import { getSupabaseClient } from "../supabase";

export interface StorySummaryViewModel {
  id: string;
  title: string;
  author: string;
  accentColor: string;
}

export interface StoryDetailViewModel extends StorySummaryViewModel {
  constitutionMarkdown: string | null;
  visualDesignDocument: unknown | null;
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
