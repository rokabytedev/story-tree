import { redirect } from "next/navigation";
import { storyTabs } from "@/components/storySidebar";

export default async function StoryDetailRedirect({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const defaultTab = storyTabs[0];
  redirect(`/story/${storyId}/${defaultTab.slug}`);
}
