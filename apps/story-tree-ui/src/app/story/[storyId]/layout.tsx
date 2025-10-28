import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReactNode } from "react";
import { StorySidebar } from "@/components/storySidebar";
import { mockStories, mockStory } from "@/data/mockStory";

type StoryLayoutProps = {
  children: ReactNode;
  params: { storyId: string };
};

export function generateStaticParams() {
  return mockStories.map((story) => ({ storyId: story.id }));
}

export function generateMetadata({
  params,
}: {
  params: { storyId: string };
}): Metadata {
  const story = mockStories.find((item) => item.id === params.storyId);
  if (!story) {
    return {
      title: "Story Tree — Story Not Found",
    };
  }
  return {
    title: `Story Tree — ${story.title}`,
    description: `Explore Story Tree artifacts for ${story.title}.`,
  };
}

export default function StoryLayout({ children, params }: StoryLayoutProps) {
  const story =
    params.storyId === mockStory.id
      ? mockStory
      : mockStories.find((item) => item.id === params.storyId);

  if (!story) {
    notFound();
  }

  return (
    <div className="flex min-h-screen bg-page text-text-primary">
      <aside className="hidden w-80 shrink-0 border-r border-border bg-[#0f172a] px-6 py-10 shadow-panel lg:flex">
        <StorySidebar storyId={params.storyId} className="h-full" />
      </aside>
      <main className="flex-1 overflow-y-auto px-6 py-10 lg:px-12">
        <div className="mb-6 lg:hidden">
          <StorySidebar
            storyId={params.storyId}
            className="rounded-3xl border border-border bg-surface px-4 py-6 shadow-panel"
          />
        </div>
        <header className="mb-10 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-text-muted">
              Story Explorer
            </p>
            <h1 className="text-3xl font-semibold text-text-primary">
              {story.title}
            </h1>
            <p className="text-sm text-text-muted">Author: {story.author}</p>
          </div>
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: story.accentColor }}
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
