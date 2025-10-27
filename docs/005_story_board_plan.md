# Storyboard Task Plan

## Goal
Introduce a `CREATE_STORYBOARD` workflow task that transforms the completed pre-production package (constitution, interactive script, and visual design document) into a Gemini-generated storyboard breakdown persisted on the story record. The plan below captures the data contracts, orchestration flow, CLI wiring, and validation strategy required to ship this capability safely.

## Prerequisites
- Story constitution already stored at `stories.story_constitution`.
- Interactive script scenelets generated and available through the story tree snapshot module (same serializer used by the visual design task).
- Visual design document saved to `stories.visual_design_document`.
- System prompt `system_prompts/storyboard_artist.md` reviewed in full; it defines the output contract and cinematic expectations.

## Gemini Prompt Assembly
Storyboard generation extends the existing story tree prompt builder by adding the visual design context. The task composes the Gemini request as:

1. **System Prompt** — Use `system_prompts/storyboard_artist.md` verbatim. Do not mutate formatting or prepend additional guidance.
2. **User Prompt Sections** (single markdown document):
   - `# Story Constitution` followed by the stored markdown. Preserve the exact text.
   - `# Interactive Script Story Tree (YAML)` with:
     - The deterministic YAML snapshot emitted by the existing story tree serializer (`scenelet-1`, `branching-point-1`, etc.).
     - A short explainer reminding Gemini that branching entries reference `leads_to` scenelet ids and that `dialogue`/`shot_suggestions` appear under each scenelet.
   - `# Visual Design Document` containing the canonical JSON/markdown saved from `CREATE_VISUAL_DESIGN`. Do not redact sections; this document is the visual bible the system prompt relies on.
3. **Request Options** — Reuse any shared Gemini client defaults (model, temperature, retry strategy). The storyboard task should not introduce bespoke tuning unless explicitly required later.

Unit tests must snapshot the assembled user prompt to catch regressions in formatting, section order, or missing inputs.

## Response Contract & Validation
Gemini responds with a single JSON object containing `storyboard_breakdown`, an array of shot descriptors. Each element must satisfy:

```json
{
  "scenelet_id": "scenelet-3",
  "shot_index": 1,
  "framing_and_angle": "Medium Close-Up",
  "composition_and_content": "Subject placement description…",
  "character_action_and_emotion": "Physical beats and emotional read…",
  "dialogue": [
    { "character": "Finn", "line": "Are we sure this is safe?" }
  ],
  "camera_dynamics": "Static | Dolly In | Pan Left | …",
  "lighting_and_atmosphere": "Mood-driven lighting callouts…"
}
```

Validation rules:
- `scenelet_id` MUST match the human-readable identifiers from the story tree snapshot (`scenelet-<n>`, never Supabase UUIDs). Reject mismatches.
- `shot_index` is a positive integer and restarts at 1 for each scenelet. Verify ordering during parsing.
- `dialogue` entries reference character names exactly matching `character_designs[*].character_name` from the visual design document. Detect case mismatches up front.
- Accumulate every dialogue line from the source scenelet and assert it appears exactly once across the shot list. Flag omissions or duplicates.
- Require all string fields to be non-empty after trimming. Include friendly error messages that mention the offending scenelet/shot.
- Accept additional fields by ignoring them for now (forward compatibility), but never persist unvalidated structures.

Persist the validated object to `stories.storyboard_breakdown` via `StoriesRepository.updateStoryArtifacts({ storyboardBreakdown })`. The repository already maps to the JSONB column; ensure the workflow’s unit tests cover both success and duplicate-run failure cases.

## Workflow Integration
- Task identifier: `CREATE_STORYBOARD`.
- Extend `StoryWorkflow` task type union and execution switch to include the storyboard task immediately after `CREATE_VISUAL_DESIGN` in both `runTask` and `runAllTasks`.
- Prerequisite checks:
  - Constitution present.
  - Scenelets exist (interactive script completed).
  - Visual design document present.
  - `storyboard_breakdown` field empty (task is idempotent for now).
- Execution flow:
  1. Load constitution, scenelets snapshot, and visual design document.
  2. Assemble Gemini prompt (system + user sections).
  3. Invoke Gemini via injected client, respecting stub/real mode.
  4. Parse and validate JSON per rules above.
  5. Persist to `storyboard_breakdown`.
- Error handling: throw explicit `AgentWorkflowError` variants for missing prerequisites or validation failures so the CLI can echo actionable feedback.

## CLI Support
- Add `CREATE_STORYBOARD` to the workflow CLI’s allowed task list, help text, and validation.
- `run-all` path should automatically include storyboard generation after the visual design task.
- Stub mode requirements:
  - Create a deterministic Gemini fixture under `agent-backend/fixtures/gemini/storyboard/` (e.g., `success.json`) mirroring the expected response schema.
  - Wire the CLI stub loader so `--mode stub` returns the fixture for storyboard requests. Reuse the existing stub plumbing (consider backfilling a visual design stub if bandwidth permits, but it is optional for this change).
- Real mode should propagate Gemini and validation errors without masking stack traces in debug logs.

## Testing Strategy
- **Prompt Builder Unit Tests** (`agent-backend/test/storyboardPromptBuilder.test.ts`): cover happy path and missing prerequisite inputs; snapshot the user prompt.
- **Response Validator Unit Tests** (`agent-backend/test/storyboardResponseValidator.test.ts`): ensure schema enforcement, dialogue coverage, invalid `scenelet_id`, and character name mismatches surface descriptive errors.
- **Workflow Task Tests** (`agent-backend/test/storyboardTask.test.ts`): simulate success, missing constitution, missing scenelets, missing visual design, duplicate run, Gemini failure, and validation failure. Assert repository interactions and stored payload.
- **Integration Tests** (`agent-backend/test/storyboardIntegration.test.ts`): exercise the full workflow task with stubbed Gemini to confirm persistence and task ordering within `runAllTasks`.
- **CLI Tests** (`agent-backend/test/agentWorkflowCli.test.ts`): verify `--task CREATE_STORYBOARD` routing, stub mode output, and `run-all` sequencing.
- **Repository Tests** (extend existing Supabase tests): confirm `storyboard_breakdown` round-trips and remains untouched when other artifacts update.

## Developer Notes
- Reuse shared helpers from the visual design task (e.g., story tree serialization) to keep the codebase consistent.
- Keep the storyboard response validator pure and dependency-free so tests can exercise it with synthetic data.
- Document the new task in any developer onboarding materials once implementation ships.
