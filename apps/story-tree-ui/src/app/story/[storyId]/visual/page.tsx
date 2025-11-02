import { EmptyState } from "@/components/emptyState";
import { VisualReferenceView } from "@/components/visual/VisualReferenceView";
import { parseVisualDesignDocument } from "@/lib/visualDesignDocument";
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

    const parsedDocument = parseVisualDesignDocument(story.visualDesignDocument);

    if (!parsedDocument) {
      return (
        <EmptyState
          title="Visual design unavailable"
          message="Visual design outputs will populate once the workflow runs for this story."
        />
      );
    }

    return (
      <VisualReferenceView document={parsedDocument} />
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "SupabaseConfigurationError"
        ? error.message
        : "Visual design data could not be loaded from Supabase.";
    return <EmptyState title="Visual design unavailable" message={message} />;
  }
}
