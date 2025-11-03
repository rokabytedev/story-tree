# Visual Design Task Plan

## Goal
Add a `CREATE_VISUAL_DESIGN` workflow task that turns a completed interactive script plus its story constitution into a Gemini-generated visual design document saved on the `stories` record. The plan below details the data contracts, orchestration flow, and testing expectations for delivering this capability.

## Prerequisites
- Story constitution already persisted (`stories.story_constitution`).
- Interactive script generated and stored as scenelets (`scenelets` table).
- System prompt `system_prompts/create_visual_design.md` reviewed in full; its structure drives the Gemini invocation.

## Story Tree Data Contract
Visual design requires the entire branching script in a format that is both human-readable and gentle on Gemini. The repository exposes a story tree snapshot that can be rendered directly as YAML with minimal nesting. The serializer emits a single ordered list where scenelets and branching points appear in the exact narrative sequence:

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
- scenelet-2:
    description: ...
    dialogue:
      # additional lines here
    shot_suggestions:
      # more beats here
- branching-point-1:
    choice_prompt: What should the hero do next?
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

The story tree structure follows natural continuation until hitting a `branching-point`. After a branching point, the first choice's sub-tree immediately follows the branching node (its first scenelet carries `role: branch`). When that sub-tree finishes (the last scenelet marked `role: terminal`), the serializer continues with the next choice's sub-tree, preserving depth-first order.

Key expectations:
- Scenelet ids follow sequential, human-readable labels (`scenelet-1`, `scenelet-2`, …); branching points use `branching-point-1`, etc.
- Roles:
  - `root`: the first scenelet
  - `branch`: the first scenelet of a branch (include `choice_label` to restate the choice)
  - `terminal`: the end of a branch
  - omit `role` entirely for straight-through continuations to keep the YAML compact
- Scenelet entries surface just the narrative content fields needed by the visual designer: `description`, `dialogue`, `shot_suggestions`, plus optional `choice_label`.
- Branching entries provide the `choice_prompt` and a list of `{ label, leads_to }` pairs referencing the sequential scenelet ids.
- Supabase UUIDs and story ids never appear in the digest.
- Serializer errors surface clear messages when the tree is malformed (missing root, orphaned children, conflicting parent links).
- Keep the serializer pure: database fetching and tree assembly live in separate modules so TDD can operate on in-memory arrays of scenelets.

### Snapshot Schema
The storage layer returns a snapshot shaped for both YAML emission and richer assertions in tests. The TypeScript contract is the authoritative source:

```ts
type SceneletDigest = {
  id: string;                 // scenelet-1, scenelet-2, ...
  parentId: string | null;    // null only for the root scenelet
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
  entries: StoryTreeEntry[];  // depth-first order
  yaml: string;               // deterministic YAML representation
}
```

Additional guarantees:
- `entries` preserves a depth-first traversal so tests can assert the exact sequence alongside the YAML string.
- `role` is set to `'linear'` during assembly and omitted automatically when formatting YAML, ensuring the serializer can round-trip without leaking extra metadata.
- Invalid trees surface typed errors identifying the offending scenelet so debugging malformed data remains straightforward.

## Task Flow
1. **Load Story Inputs**
   - Fetch the target story; validate constitution exists and `visual_design_document` is empty (duplicate runs remain unsupported for now).
   - Retrieve scenelets for the story via the repository and build the story tree snapshot.
2. **Assemble Gemini Prompt**
   - System prompt: `create_visual_design.md`.
   - User prompt sections:
     1. Constitution markdown (verbatim).
     2. `Interactive Script Story Tree (YAML)` block containing the serializer’s YAML string (no Supabase identifiers). Include a short primer on the snapshot syntax so Gemini understands the flattened structure.
   - Keep formatting deterministic; unit tests should snapshot the final prompt string.
3. **Call Gemini**
   - Inject Gemini client; the task only formats request/response.
   - Retry strategy mirrors existing workflow defaults (if any); otherwise bubble errors to the caller.
4. **Persist Visual Design Document**
   - Parse Gemini JSON; require a `visual_design_document` root object.
   - Persist via stories repository (single call that sets `visual_design_document` and leaves other fields untouched).

## Workflow Integration
- Task identifier: `CREATE_VISUAL_DESIGN`.
- Sequenced immediately after `CREATE_INTERACTIVE_SCRIPT` for both `runTask` and `runAllTasks`.
- On missing prerequisites (constitution or scenelets) the task should throw and avoid side effects.
- If `visual_design_document` already exists, surface a descriptive error and skip mutation.
- CLI command gains a new task option instead of adding a separate command; update help text and validation accordingly.

## Developer Workflow
### Running the Task
- Use the agent workflow CLI to trigger the task for an existing story:
  ```bash
  npm run agent-workflow:cli -- run-task --task CREATE_VISUAL_DESIGN --story-id <story-id> --mode stub
  ```
  The `stub` mode exercises the end-to-end flow with fixture Gemini responses; switch to `--mode real` when targeting live services.
- `run-all` automatically executes `CREATE_VISUAL_DESIGN` after the interactive script step, so no additional wiring is required when invoking the full pipeline.

### Testing Expectations
- Serializer unit tests live in `agent-backend/test/storyTreeSnapshot.test.ts` and cover linear, branching, and error cases using golden YAML snapshots.
- Visual design task unit tests (`agent-backend/test/visualDesignTask.test.ts`) validate prompt assembly, Gemini parsing, prerequisite failures, and repeated invocations.
- Integration tests (`agent-backend/test/visualDesignIntegration.test.ts`) exercise the real story tree loader with stubbed Gemini responses for success, missing interactive data, Gemini parse errors, and duplicate execution checks.
- CLI coverage ensures `CREATE_VISUAL_DESIGN` is exposed, scheduled in `run-all`, and respects stubbed environments via `agent-backend/test/agentWorkflowCli.test.ts`.

## Testing Strategy (TDD Required)
- **Serializer Unit Tests:** linear stories, branching stories, orphan detection, deterministic output ordering.
- **Workflow Task Unit Tests:** happy path (persists JSON), missing prerequisites, Gemini malformed JSON, repository failure propagation, duplicate-run rejection when `visual_design_document` already set.
- **CLI Tests:** ensures `--task CREATE_VISUAL_DESIGN` (or equivalent) invokes the workflow and bubbles task errors.
- **Snapshot Tests:** for the Gemini prompt payload to catch accidental formatting regressions.

## Review & Alignment
- Share the serializer contract and workflow sequencing with stakeholders before implementation.
- Confirm that the visual design document schema meets downstream consumption needs prior to shipping the task.

## Deliverables
- Updated workflow and CLI codepaths that satisfy the specs in `openspec/changes/add-visual-design-task/specs`.
- Story tree serializer module with test suite.
- Persisted visual design document on successful runs, accessible via the stories repository.
- Engineering documentation (this file) capturing the implementation checklist and data contracts.
