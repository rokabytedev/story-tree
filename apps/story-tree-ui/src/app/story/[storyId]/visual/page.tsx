import { EmptyState } from "@/components/emptyState";
import { VisualReferenceView } from "@/components/visual/VisualReferenceView";
import { getStory } from "@/server/data/stories";

type PageProps = {
  params: Promise<{ storyId: string }>;
};

export default async function VisualTab({ params }: PageProps) {
  const { storyId } = await params;
  try {
    const story = await getStory(storyId);

    if (!story) {
      return (
        <EmptyState
          title="Story not found"
          message="The requested story could not be found."
        />
      );
    }

    // Show empty state only if both visual design doc and reference package are missing
    if (!story.visualDesignDocument && !story.visualReferencePackage) {
      return (
        <EmptyState
          title="Visual design unavailable"
          message="Visual design outputs will populate once the workflow runs for this story."
        />
      );
    }

    return (
      <VisualReferenceView
        visualReferencePackage={story.visualReferencePackage}
        visualDesignDocument={story.visualDesignDocument}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "SupabaseConfigurationError"
        ? error.message
        : "Visual design data could not be loaded from Supabase.";
    return <EmptyState title="Visual design unavailable" message={message} />;
  }
}
