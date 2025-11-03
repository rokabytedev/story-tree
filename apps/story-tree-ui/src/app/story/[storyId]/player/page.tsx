import { EmbeddedPlayer } from "@/components/player/embeddedPlayer";
import { getEmbeddedStoryBundle } from "@/server/data/stories";

type PlayerPageProps = {
  params: Promise<{ storyId: string }>;
};

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { storyId } = await params;
  const bundle = await getEmbeddedStoryBundle(storyId);

  if (!bundle) {
    return (
      <div className="rounded-3xl border border-border bg-surface px-6 py-12 text-center text-sm text-text-muted">
        Player bundle is not available for this story yet. Generate shots and audio, then refresh this page.
      </div>
    );
  }

  return <EmbeddedPlayer bundle={bundle} />;
}
