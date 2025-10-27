export type SceneletRole = 'root' | 'branch' | 'terminal' | 'linear';

export interface DialogueDigestLine {
  character: string;
  line: string;
}

export interface SceneletDigest {
  id: string;
  parentId: string | null;
  role: SceneletRole;
  choiceLabel?: string | null;
  description: string;
  dialogue: DialogueDigestLine[];
  shotSuggestions: string[];
}

export interface BranchingPointDigest {
  id: string;
  sourceSceneletId: string;
  choicePrompt: string;
  choices: Array<{ label: string; leadsTo: string }>;
}

export type StoryTreeEntry =
  | { kind: 'scenelet'; data: SceneletDigest }
  | { kind: 'branching-point'; data: BranchingPointDigest };

export interface StoryTreeSnapshot {
  entries: StoryTreeEntry[];
  yaml: string;
}

export interface StoryTreeSceneletSource {
  id: string;
  parentId: string | null;
  choiceLabelFromParent: string | null;
  choicePrompt: string | null;
  content: unknown;
  isBranchPoint: boolean;
  isTerminalNode: boolean;
  createdAt: string;
}
