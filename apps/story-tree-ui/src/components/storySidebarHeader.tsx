"use client";

import Image from "next/image";
import Link from "next/link";
import { HomeIcon } from "@heroicons/react/24/outline";
import { storybookPalette } from "@/theme/palette";

type StorySidebarHeaderProps = {
  title?: string | null;
  author?: string | null;
  thumbnailSrc?: string | null;
  accentColor?: string | null;
};

function buildAccentBackground(accentColor?: string | null) {
  const fallback = storybookPalette.highlight;
  if (!accentColor) {
    return `linear-gradient(135deg, ${fallback} 0%, ${storybookPalette.accentMuted} 100%)`;
  }

  const isHexColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentColor);
  const start = isHexColor ? accentColor : fallback;
  return `linear-gradient(135deg, ${start} 0%, ${storybookPalette.accentMuted} 100%)`;
}

export function StorySidebarHeader({
  title,
  author,
  thumbnailSrc,
  accentColor,
}: StorySidebarHeaderProps) {
  const displayTitle = title?.trim() || "Story unavailable";
  const displayAuthor = author?.trim();
  const initial = displayTitle.slice(0, 1).toUpperCase() || "?";
  const accentBackground = buildAccentBackground(accentColor);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Link
          href="/story"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-primary transition hover:bg-surface"
          aria-label="Back to story list"
        >
          <HomeIcon className="h-5 w-5" aria-hidden />
        </Link>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
          Story Tree
        </span>
      </div>
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-surface-elevated px-4 py-4 shadow-panel">
        <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-surface">
          {thumbnailSrc ? (
            <Image
              src={thumbnailSrc}
              alt={`${displayTitle} thumbnail`}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-2xl text-lg font-semibold uppercase text-page"
              style={{ background: accentBackground }}
            >
              {initial}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">
            Story Explorer
          </p>
          <h2 className="text-lg font-semibold leading-tight text-text-primary">{displayTitle}</h2>
          {displayAuthor ? (
            <p className="text-xs text-text-muted">by {displayAuthor}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
