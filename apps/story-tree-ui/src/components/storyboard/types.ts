export type SceneletRole = "root" | "branch" | "terminal" | "linear";

export interface StoryboardDialogueLine {
  character: string;
  line: string;
}

export interface ShotImage {
  shotIndex: number;
  keyFrameImagePath: string | null;
  videoFilePath: string | null;
  storyboardPayload: unknown;
  createdAt: string;
}

export interface StoryboardScenelet {
  id: string;
  parentId: string | null;
  role: SceneletRole;
  description: string;
  dialogue: StoryboardDialogueLine[];
  shotSuggestions: string[];
  shots: ShotImage[];
  choiceLabel?: string | null;
}

export interface StoryboardBranchingChoice {
  label: string;
  leadsTo: string;
}

export interface StoryboardBranchingPoint {
  id: string;
  sourceSceneletId: string;
  choicePrompt: string;
  choices: StoryboardBranchingChoice[];
}

export interface StoryTreeData {
  scenelets: StoryboardScenelet[];
  branchingPoints: StoryboardBranchingPoint[];
}

export interface SceneletNodeData extends Record<string, unknown> {
  type: "scenelet";
  scenelet: StoryboardScenelet;
  onShotClick?: (shot: ShotImage) => void;
}

export interface BranchingPointNodeData extends Record<string, unknown> {
  type: "branching-point";
  branchingPoint: StoryboardBranchingPoint;
}
