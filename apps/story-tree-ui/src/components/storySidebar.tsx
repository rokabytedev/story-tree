"use client";

import Link from "next/link";
import { type ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  FilmIcon,
  PhotoIcon,
  MusicalNoteIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";

import { StorySidebarHeader } from "@/components/storySidebarHeader";

type SidebarTab = {
  slug: string;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

function StoryboardGridIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <rect x="4.75" y="4.75" width="14.5" height="6.5" rx="1.5" />
      <rect x="4.75" y="12.75" width="6.75" height="6.5" rx="1.5" />
      <rect x="12.5" y="12.75" width="6.75" height="6.5" rx="1.5" />
    </svg>
  );
}

export const storyTabs: SidebarTab[] = [
  {
    slug: "constitution",
    label: "Constitution",
    description: "Story blueprint & principles",
    Icon: BookOpenIcon,
  },
  {
    slug: "script",
    label: "Script",
    description: "Branching script overview",
    Icon: FilmIcon,
  },
  {
    slug: "visual",
    label: "Visual",
    description: "Character & world art",
    Icon: PhotoIcon,
  },
  {
    slug: "audio",
    label: "Audio",
    description: "Music & sound plan",
    Icon: MusicalNoteIcon,
  },
  {
    slug: "storyboard",
    label: "Storyboard",
    description: "Explore branching flow",
    Icon: StoryboardGridIcon,
  },
  {
    slug: "player",
    label: "Player",
    description: "Preview interactive playback",
    Icon: PlayCircleIcon,
  },
];

type StorySidebarProps = {
  storyId: string;
  story?: {
    title?: string | null;
    thumbnailSrc?: string | null;
    accentColor?: string | null;
  };
  className?: string;
};

export function StorySidebar({ storyId, story, className = "" }: StorySidebarProps) {
  const pathname = usePathname();
  const composedClassName = [`flex h-full flex-col gap-8`, className].filter(Boolean).join(" ");

  return (
    <nav className={composedClassName}>
      <StorySidebarHeader
        title={story?.title}
        thumbnailSrc={story?.thumbnailSrc ?? null}
        accentColor={story?.accentColor ?? null}
      />
      <ul className="flex flex-col gap-1">
        {storyTabs.map(({ slug, label, description, Icon }) => {
          const href = `/story/${storyId}/${slug}`;
          const isActive = pathname === href;
          return (
            <li key={slug} className="-mx-6">
              <Link
                href={href}
                aria-label={`${label} — ${description}`}
                aria-current={isActive ? "page" : undefined}
                className={`group flex w-full items-start gap-3 px-6 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight ${
                  isActive
                    ? "bg-page font-semibold text-highlight"
                    : "text-text-muted hover:bg-page hover:text-text-primary"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                    isActive
                      ? "bg-highlight/20 text-highlight"
                      : "text-text-muted group-hover:bg-highlight/10 group-hover:text-highlight"
                  }`}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-base leading-tight">{label}</span>
                  <span className="text-xs text-text-muted/80 group-hover:text-text-muted">
                    {description}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <footer className="mt-auto px-3 pb-2 text-[10px] leading-relaxed text-text-muted/80">
        <p className="uppercase tracking-[0.25em] text-text-muted">
          Preview Build
        </p>
        <p className="mt-1">
          This workspace is a prototype. Expect visual polish to evolve.
        </p>
      </footer>
    </nav>
  );
}
