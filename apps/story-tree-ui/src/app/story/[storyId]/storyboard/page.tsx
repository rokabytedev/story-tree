import { EmptyState } from "@/components/emptyState";
import { getStoryTreeData } from "@/server/data/stories";
import { StoryboardView } from "./StoryboardView";

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
          message="Invoke the interactive scriptwriting task to add scenelets to see the interactive tree."
        />
      </div>
    );
  }

  return <StoryboardView data={storyboardData} />;
}
