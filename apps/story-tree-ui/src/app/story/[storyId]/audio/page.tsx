import { EmptyState } from "@/components/emptyState";
import { AudioDesignView } from "@/components/audio/AudioDesignView";
import { getStory } from "@/server/data/stories";
import { parseAudioDesignDocument } from "@/lib/audioDesignDocument";

type PageProps = {
  params: Promise<{ storyId: string }>;
};

export default async function AudioTab({ params }: PageProps) {
  const { storyId } = await params;
  try {
    const story = await getStory(storyId);

    if (!story?.audioDesignDocument) {
      return (
        <EmptyState
          title="Audio design unavailable"
          message="Audio design artifacts will populate after the workflow completes for this story."
        />
      );
    }

    const parsedDocument = parseAudioDesignDocument(story.audioDesignDocument);

    if (!parsedDocument) {
      return (
        <EmptyState
          title="Audio design unavailable"
          message="Audio design data could not be parsed."
        />
      );
    }

    return (
      <AudioDesignView storyId={storyId} document={parsedDocument} />
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "SupabaseConfigurationError"
        ? error.message
        : "Audio design data could not be loaded from Supabase.";
    return (
      <EmptyState
        title="Audio design unavailable"
        message={message}
      />
    );
  }
}
