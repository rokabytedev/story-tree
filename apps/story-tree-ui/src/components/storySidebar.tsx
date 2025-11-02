"use client";

import Link from "next/link";
import { type ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  CommandLineIcon,
  Squares2X2Icon,
  PhotoIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/outline";

import { StorySidebarHeader } from "@/components/storySidebarHeader";

type SidebarTab = {
  slug: string;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

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
    Icon: CommandLineIcon,
  },
  {
    slug: "storyboard",
    label: "Storyboard",
    description: "Explore branching flow",
    Icon: Squares2X2Icon,
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
            <li key={slug}>
              <Link
                href={href}
                aria-label={`${label} — ${description}`}
                aria-current={isActive ? "page" : undefined}
                className={`group flex items-start gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight ${
                  isActive
                    ? "bg-surface-elevated font-semibold text-text-primary"
                    : "text-text-muted hover:bg-surface-elevated hover:text-text-primary"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${
                    isActive
                      ? "text-highlight"
                      : "text-text-muted group-hover:text-highlight"
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
      <footer className="mt-auto rounded-3xl border border-dashed border-border/60 bg-surface-elevated px-4 py-4 text-xs text-text-muted">
        <p className="font-semibold uppercase tracking-[0.2em] text-text-muted">
          Preview Build
        </p>
        <p>This workspace is a prototype. Expect visual polish to evolve.</p>
      </footer>
    </nav>
  );
}
