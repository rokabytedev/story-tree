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

  const sidebarStory = story
    ? {
        title: story.title,
        accentColor: story.accentColor,
        thumbnailSrc: story.thumbnailImagePath,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-page text-text-primary lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface lg:block lg:sticky lg:top-0 lg:h-screen">
        <StorySidebar
          storyId={storyId}
          story={sidebarStory}
          className="flex h-full flex-col overflow-y-auto px-6 py-10"
        />
      </aside>
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border bg-surface px-4 py-6 lg:hidden">
          <StorySidebar storyId={storyId} story={sidebarStory} className="flex flex-col gap-6" />
        </div>
        <main className="flex-1 overflow-y-auto px-6 pb-12 pt-8 lg:px-12">
          {loadError && (
            <p className="mb-6 rounded-xl border border-border bg-page px-4 py-3 text-sm text-text-muted">
              {loadError.name === "SupabaseConfigurationError"
                ? loadError.message
                : "Unable to load complete story data from Supabase."}
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
