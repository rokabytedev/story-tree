import { EmptyState } from "@/components/emptyState";
import { StoryboardCanvas } from "@/components/storyboard/StoryboardCanvas";
import { getStoryTreeData } from "@/server/data/stories";

export default async function StoryboardTab({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;

  const storyboardData = await getStoryTreeData(storyId);

  if (!storyboardData) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-text-muted">Storyboard Canvas</p>
          <p className="text-xs text-text-muted/80">
            Binary tree visualization will appear once this story has scenelets.
          </p>
        </header>
        <EmptyState
          title="Storyboard data unavailable"
          message={`We could not generate a storyboard for ${storyId}. Add scenelets to see the interactive tree.`}
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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
          Storyboard Canvas
        </p>
        <p className="text-xs text-text-muted/80">
          Explore the narrative flow with an interactive tree of scenelets and branching points.
        </p>
      </header>
      <StoryboardCanvas data={storyboardData} />
    </div>
  );
}
