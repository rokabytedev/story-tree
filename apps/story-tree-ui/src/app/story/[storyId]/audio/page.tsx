import { CodeBlock } from "@/components/codeBlock";
import { EmptyState } from "@/components/emptyState";
import { getStory } from "@/server/data/stories";

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

    let formatted: string;
    try {
      formatted = JSON.stringify(story.audioDesignDocument, null, 2);
    } catch {
      return (
        <EmptyState
          title="Audio design unavailable"
          message="Audio design JSON could not be serialized."
        />
      );
    }

    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-text-muted">
            Audio Design Document
          </p>
          <p className="text-xs text-text-muted/80">
            Raw JSON captured from the audio design task.
          </p>
        </header>
        <CodeBlock content={formatted} languageLabel="json" />
      </div>
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
