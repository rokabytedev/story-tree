"use client";

import { useRef, useState, useEffect } from "react";
import type { ShotImage } from "./types";

interface ShotCarouselProps {
  shots: ShotImage[];
  onShotClick: (shot: ShotImage) => void;
}

export function ShotCarousel({ shots, onShotClick }: ShotCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    updateScrollButtons();
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", updateScrollButtons);
      return () => scrollElement.removeEventListener("scroll", updateScrollButtons);
    }
  }, [shots]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 176; // w-40 (160px) + gap-3 (12px) + padding
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (shots.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
        Shots
      </p>
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-surface p-2 shadow-lg ring-1 ring-border transition-all hover:bg-surface-muted hover:shadow-xl"
            aria-label="Scroll left"
          >
            <svg
              className="h-4 w-4 text-text"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        <div
          ref={scrollRef}
          className="-mx-1 flex gap-3 overflow-x-auto pb-2 scroll-smooth"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {shots.map((shot, index) => (
            <button
              key={shot.shotIndex}
              type="button"
              onClick={() => onShotClick(shot)}
              className="group relative aspect-video w-40 min-w-[10rem] shrink-0 overflow-hidden rounded-lg bg-border/40 transition-all hover:shadow-md"
              style={{ scrollSnapAlign: "start" }}
            >
              {shot.keyFrameImagePath ? (
                <img
                  src={shot.keyFrameImagePath}
                  alt={`Shot ${shot.shotIndex}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.classList.add("flex", "items-center", "justify-center");
                      parent.innerHTML = `<span class="text-xs text-text-muted/60">Image not available</span>`;
                    }
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-xs text-text-muted/60">No image</span>
                </div>
              )}
              <div className="absolute right-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-text opacity-0 shadow-sm ring-1 ring-border/30 transition-opacity group-hover:opacity-100">
                Shot {shot.shotIndex}
              </div>
            </button>
          ))}
        </div>
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-surface p-2 shadow-lg ring-1 ring-border transition-all hover:bg-surface-muted hover:shadow-xl"
            aria-label="Scroll right"
          >
            <svg
              className="h-4 w-4 text-text"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
