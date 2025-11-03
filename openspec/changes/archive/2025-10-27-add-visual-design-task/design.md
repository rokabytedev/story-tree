## Overview
The visual design pipeline reuses the existing workflow orchestrator. We add a new task implementation that loads the story constitution, constructs an interactive script snapshot, and asks Gemini (using the visual design system prompt) for a visual design document. The result is stored on the `stories` row as JSON.

The implementation separates IO from business logic to preserve testability:
- **Data Fetching:** Repository helpers retrieve the story row and all scenelets for a story id.
- **Business Logic:** A pure assembler converts scenelets into a deterministic digest that can be rendered as flattened YAML with minimal nesting. Another pure function formats the Gemini prompt (constitution + YAML tree) and validates the Gemini response.
- **Task Shell:** The workflow task composes the helpers, enforces prerequisites, invokes Gemini via an injected client, and persists results via injected repositories.

## Story Tree Serialization
Scenelets are persisted in a flat table; visual design work needs a readable branching digest. We expose a serializer with the following contract:

```ts
type SceneletDigest = {
  id: string; // scenelet-1, scenelet-2, ...
  parentId: string | null;
  role: 'root' | 'branch' | 'terminal' | 'linear';
  choiceLabel?: string | null;
  description: unknown;
  dialogue: unknown;
  shotSuggestions: unknown;
};

type BranchingPointDigest = {
  id: string; // branching-point-1, branching-point-2, ...
  sourceSceneletId: string;
  choicePrompt: string;
  choices: Array<{ label: string; leadsTo: string }>;
};

type StoryTreeEntry =
  | { kind: 'scenelet'; data: SceneletDigest }
  | { kind: 'branching-point'; data: BranchingPointDigest };

interface StoryTreeSnapshot {
  entries: StoryTreeEntry[]; // depth-first order
  yaml: string; // stable YAML representation matching docs/004_concept_art_and_production_design_plan.md
}
```

Serializer inputs:
1. All scenelets for the story (ordered by creation).
2. Optional scenelet content shape (opaque to serializer).

Implementation outline:
1. Sort scenelets by depth-first order to ensure deterministic numbering.
2. Assign human-readable ids (`scenelet-1`, `scenelet-2`, …) as scenelets are encountered; branch points receive `branching-point-1`, etc., based on discovery order.
3. Build `SceneletDigest` entries extracting `description`, `dialogue`, and `shot_suggestions` from the stored JSON content; omit raw Supabase uuids.
4. For branch points, record the prompt and each choice label/target scenelet id in `BranchingPointDigest`.
5. Generate a YAML document that mirrors the flattened structure referenced in the plan:

```yaml
- scenelet-1:
    role: root
    description: ...
    dialogue:
      - character: Rhea
        line: "Or we launch with a challenge to jolt them awake."
      - character: Testing Agent
        line: "Noted. Tracking elevated tension and time pressure cues."
    shot_suggestions:
      - "Tracking shot following a glowing branch that pulses with warning colors."
      - "Close-up of countdown timer materializing in mid-air."
- branching-point-1:
    choice_prompt: ...
    choices:
      - label: Investigate the cave
        leads_to: scenelet-3
      - label: Return to shore
        leads_to: scenelet-5
- scenelet-3:
    role: branch
    choice_label: Investigate the cave
    description: ...
    dialogue:
      # ...
    shot_suggestions:
      # ...
- scenelet-4:
    role: terminal
    description: ...
    dialogue:
      # ...
    shot_suggestions:
      # ...
- scenelet-5:
    role: branch
    choice_label: Return to shore
    description: ...
    dialogue:
      # ...
    shot_suggestions:
      # ...
- scenelet-6:
    role: terminal
    description: ...
    dialogue:
      # ...
    shot_suggestions:
      # ...
```

Entries remain in depth-first order. After a branching point, the serializer emits the first choice's sub-tree immediately (with its leading scenelet marked `role: 'branch'`). Once that branch reaches a terminal scenelet, the next choice's sub-tree follows, continuing until all branches have been serialized. When serializing to YAML, omit the `role` field for `linear` entries so simple continuations stay lean.

The serializer surfaces explicit errors when the tree is malformed (missing root, orphaned children, duplicate parent links). Scenelet and branching ids remain stable across runs given the same input order.

## Gemini Prompt Assembly
The visual design task formats a single user prompt containing:
1. Story constitution markdown (verbatim).
2. `Interactive Script Story Tree (YAML)` section with the serializer’s YAML string.

No Supabase ids or display names are added; the constitution already captures naming context. The Gemini system prompt remains `system_prompts/create_visual_design.md`. Payload assembly is pure so tests can snapshot expected prompts. The Gemini response is expected to be JSON with a `visual_design_document` root object. Validation isolates parsing errors with descriptive messages.

## Workflow Task Contract
Task identifier: `CREATE_VISUAL_DESIGN`.

Execution steps:
1. Load story row; fail if constitution missing.
2. Ensure interactive script already generated (scenelets exist) and `visual_design_document` is not already populated; if it is, return an error explaining the document is already present.
3. Fetch scenelets and build the story tree snapshot.
4. Call Gemini; on success, persist the returned JSON to `stories.visual_design_document`.

CLI integration extends the existing workflow runner command to accept the new task name and updates help text.

## Error Handling & Observability
- Serializer errors include the offending scenelet ids.
- Gemini failures bubble with sanitized context.
- Persistence errors return repository messages without leaking secrets.

## Testing Strategy
- Unit tests for serializer cover:
  - Linear stories.
  - Branching nodes with multiple children.
    - At least some test cases that cover 2-3 branching nodes
  - At least some tests should use "golden" YAML (whole) to diff against
    - (so that it's easier for human to review)
  - Detection of missing root or orphaned children.
- Workflow task unit tests mock repositories and Gemini client:
  - Success path persists JSON.
  - Missing constitution or empty scenelets produce validation errors.
  - Gemini malformed JSON surfaces parsing error.
  - Re-running when `visual_design_document` already exists returns an error without mutating data.
- CLI tests ensure the new task flag dispatches correctly.
