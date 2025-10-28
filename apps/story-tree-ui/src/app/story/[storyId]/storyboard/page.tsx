import { EmptyState } from "@/components/emptyState";

export default async function StoryboardTab({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
          Storyboard Canvas
        </p>
        <p className="text-xs text-text-muted/80">
          Binary tree visualization is under construction.
        </p>
      </header>
      <EmptyState
        title="Storyboard preview coming soon"
        message={`We are designing an interactive tree canvas for ${storyId}. Follow the UI bootstrap tasks to stay notified when the visualization ships.`}
      />
      <p className="text-xs text-text-muted/70">
        Curious about the upcoming experience? Review{" "}
        <span className="font-medium text-highlight">
          ui_mocks/storyboard.{`{png,html}`}
        </span>{" "}
        in the repository for the current design direction.
      </p>
    </div>
  );
}
