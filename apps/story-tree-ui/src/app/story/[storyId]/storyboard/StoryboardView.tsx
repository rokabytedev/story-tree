"use client";

import { useState } from "react";
import { StoryboardCanvas } from "@/components/storyboard/StoryboardCanvas";
import { ShotDetailPanel } from "@/components/storyboard/ShotDetailPanel";
import type { StoryTreeData, ShotImage } from "@/components/storyboard/types";

interface StoryboardViewProps {
  data: StoryTreeData;
}

export function StoryboardView({ data }: StoryboardViewProps) {
  const [selectedShot, setSelectedShot] = useState<ShotImage | null>(null);

  const handleShotClick = (shot: ShotImage) => {
    setSelectedShot(shot);
  };

  const handleClosePanel = () => {
    setSelectedShot(null);
  };

  return (
    <>
      <StoryboardCanvas data={data} onShotClick={handleShotClick} />
      <ShotDetailPanel shot={selectedShot} onClose={handleClosePanel} />
    </>
  );
}
