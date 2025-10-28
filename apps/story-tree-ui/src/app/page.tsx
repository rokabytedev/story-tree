import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-page text-text-primary">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-8 py-24">
        <p className="text-sm uppercase tracking-[0.35em] text-text-muted">
          Story Tree UI
        </p>
        <h1 className="text-4xl font-semibold sm:text-5xl">
          Bootstrap in progress
        </h1>
        <p className="text-lg text-text-muted">
          This workspace will evolve into the Story Explorer experience. Upcoming
          milestones add the tabbed shell, themed layout, and artifact viewers
          for constitution, script, storyboard, visual, and audio outputs.
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://github.com/rokabyte/story-tree"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary shadow-panel transition hover:border-highlight hover:shadow-[0_20px_45px_rgba(10,16,32,0.55)]"
          >
            Project Repository
          </a>
          <Link
            href="/story"
            className="inline-flex items-center justify-center rounded-xl border border-transparent bg-highlight px-4 py-2 text-sm font-semibold text-page transition hover:opacity-90"
          >
            Upcoming Story Index
          </Link>
        </div>
      </section>
    </main>
  );
}
