import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import { StorySidebar } from "@/components/storySidebar";
import { getStory } from "@/server/data/stories";
import type { StoryDetailViewModel } from "@/server/data/stories";

export const dynamic = "force-dynamic";

type StoryLayoutProps = {
  children: ReactNode;
  params: Promise<{ storyId: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storyId: string }>;
}): Promise<Metadata> {
  const { storyId } = await params;
  try {
    const story = await getStory(storyId);
    if (!story) {
      return {
        title: "Story Tree — Story Not Found",
      };
    }

    return {
      title: `Story Tree — ${story.title}`,
      description: `Explore Story Tree artifacts for ${story.title}.`,
    };
  } catch {
    return {
      title: "Story Tree — Story",
      description: "Story Tree artifacts browser.",
    };
  }
}

export default async function StoryLayout({ children, params }: StoryLayoutProps) {
  const { storyId } = await params;
  let story: StoryDetailViewModel | null = null;
  let loadError: Error | null = null;

  try {
    story = await getStory(storyId);
  } catch (error) {
    console.error("Failed to load story detail view", error);
    loadError = error instanceof Error ? error : new Error("Unknown story load error");
  }

  if (!story && !loadError) {
    notFound();
  }

  const accentColor = story?.accentColor ?? "#6366f1";

  return (
    <div className="flex min-h-screen bg-page text-text-primary">
      <aside className="hidden w-80 shrink-0 border-r border-border bg-[#0f172a] px-6 py-10 shadow-panel lg:flex">
        <StorySidebar storyId={storyId} className="h-full" />
      </aside>
      <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-12">
        <div className="mb-6 lg:hidden">
          <StorySidebar
            storyId={storyId}
            className="rounded-3xl border border-border bg-surface px-4 py-6 shadow-panel"
          />
        </div>
        <header className="mb-10 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-text-muted">
              Story Explorer
            </p>
            <h1 className="text-3xl font-semibold text-text-primary">
              {story?.title ?? "Story unavailable"}
            </h1>
            <p className="text-sm text-text-muted">
              Author: {story?.author ?? "Unknown"}
            </p>
            {loadError && (
              <p className="mt-3 text-xs text-text-muted/70">
                {loadError.name === "SupabaseConfigurationError"
                  ? loadError.message
                  : "Story data could not be loaded from Supabase."}
              </p>
            )}
          </div>
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
        </header>
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-panel lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
