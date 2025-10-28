import { redirect } from "next/navigation";
import { storyTabs } from "@/components/storySidebar";

export default function StoryDetailRedirect({
  params,
}: {
  params: { storyId: string };
}) {
  const defaultTab = storyTabs[0];
  redirect(`/story/${params.storyId}/${defaultTab.slug}`);
}
