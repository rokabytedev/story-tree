export type SceneletRole = "root" | "branch" | "terminal" | "linear";

export interface StoryboardDialogueLine {
  character: string;
  line: string;
}

export interface StoryboardScenelet {
  id: string;
  parentId: string | null;
  role: SceneletRole;
  description: string;
  dialogue: StoryboardDialogueLine[];
  shotSuggestions: string[];
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

export interface SceneletNodeData {
  type: "scenelet";
  scenelet: StoryboardScenelet;
}

export interface BranchingPointNodeData {
  type: "branching-point";
  branchingPoint: StoryboardBranchingPoint;
}
