"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarTab = {
  slug: string;
  label: string;
  description: string;
  Icon: (props: { className?: string }) => JSX.Element;
};

const iconProps = "h-5 w-5";

const BookIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${iconProps} ${className}`}
  >
    <path d="M4 19.5V6.75A2.25 2.25 0 0 1 6.25 4.5h11.5A2.25 2.25 0 0 1 20 6.75V19.5" />
    <path d="M4 19.5A2.25 2.25 0 0 1 6.25 21h11.5A2.25 2.25 0 0 1 20 18.75V19.5" />
    <path d="M8 8h8M8 11h4" />
  </svg>
);

const ScriptIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${iconProps} ${className}`}
  >
    <path d="M6 4h9l3 3v13H6z" />
    <path d="M9 9h4M9 13h6" />
  </svg>
);

const TreeIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${iconProps} ${className}`}
  >
    <path d="M12 3 7 12h10l-5 9" />
  </svg>
);

const PaletteIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${iconProps} ${className}`}
  >
    <path d="M12 3a9 9 0 1 0 0 18c.9 0 1.5-.6 1.5-1.5S12.9 18 12 18a6 6 0 0 1 0-12" />
    <path d="M7.5 10.5h.01M9.5 7.5h.01M14.5 7.5h.01M16.5 10.5h.01" />
  </svg>
);

const WaveformIcon = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${iconProps} ${className}`}
  >
    <path d="M4 12h2l1.2-3.5 2 7 2.5-9 2.6 9 1.9-7L19 12h1" />
  </svg>
);

export const storyTabs: SidebarTab[] = [
  {
    slug: "constitution",
    label: "Constitution",
    description: "Story constitution Markdown output",
    Icon: BookIcon,
  },
  {
    slug: "script",
    label: "Script",
    description: "Interactive script YAML tree",
    Icon: ScriptIcon,
  },
  {
    slug: "storyboard",
    label: "Storyboard",
    description: "Storyboard canvas placeholder",
    Icon: TreeIcon,
  },
  {
    slug: "visual",
    label: "Visual",
    description: "Visual design JSON metadata",
    Icon: PaletteIcon,
  },
  {
    slug: "audio",
    label: "Audio",
    description: "Audio design JSON metadata",
    Icon: WaveformIcon,
  },
];

type StorySidebarProps = {
  storyId: string;
  className?: string;
};

export function StorySidebar({ storyId, className = "" }: StorySidebarProps) {
  const pathname = usePathname();

  return (
    <nav className={`flex flex-col justify-between gap-8 ${className}`}>
      <div>
        <div>
          <Link
            href="/story"
            className="group flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-text-muted transition hover:text-text-primary"
          >
            <span className="h-2 w-2 rounded-full bg-highlight transition group-hover:scale-110" />
            Story Tree
          </Link>
        </div>
        <ul className="mt-6 space-y-1">
          {storyTabs.map(({ slug, label, description, Icon }) => {
            const href = `/story/${storyId}/${slug}`;
            const isActive = pathname === href;
            return (
              <li key={slug}>
                <Link
                  href={href}
                  aria-label={`${label} — ${description}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight ${
                    isActive
                      ? "bg-surface text-text-primary shadow-panel"
                      : "text-text-muted hover:bg-surface-muted/60 hover:text-text-primary"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                      isActive
                        ? "border-highlight bg-highlight/10 text-highlight"
                        : "border-border text-text-muted group-hover:text-text-primary"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>
                  <div className="flex flex-col">
                    <span>{label}</span>
                    <span className="text-xs text-text-muted/80 group-hover:text-text-muted">
                      {description}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <footer className="text-xs text-text-muted/70">
        <p className="font-semibold uppercase tracking-[0.2em] text-text-muted">
          Upcoming
        </p>
        <p>Storyboard canvas · Live data binding</p>
      </footer>
    </nav>
  );
}
