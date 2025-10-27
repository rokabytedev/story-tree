# Audio Design Task Plan

## Goal
Add a `CREATE_AUDIO_DESIGN` workflow task that converts the completed pre-production package (constitution, interactive script, and visual design document) into a Gemini-generated audio design document saved on the story record. This plan documents the data contracts, Gemini prompt structure, validation rules, workflow wiring, CLI touchpoints, and testing strategy required to productionize the capability.

## Prerequisites
- Story constitution stored in `stories.story_constitution`.
- Interactive script scenelets generated and exposed through the story tree snapshot serializer used by prior tasks.
- Visual design document populated at `stories.visual_design_document`.
- System prompt `system_prompts/audio_director.md` reviewed in detail; it defines the output schema, naming constraints, and creative expectations.

The task intentionally does **not** require the storyboard artifact, but in the default pipeline it will execute after `CREATE_STORYBOARD` to keep downstream orchestration simple.

## Gemini Prompt Assembly
Audio design reuses the same deterministic prompt assembly style as the storyboard task with audio-specific framing. The request format is:

1. **System Prompt** — supply `system_prompts/audio_director.md` verbatim. Preserve whitespace and headings to avoid mismatched expectations.
2. **User Prompt** — a single markdown document assembled in this order:
   - `# Story Constitution` followed by the exact markdown stored on the story.
   - `# Interactive Script Story Tree (YAML)` containing:
     - The YAML snapshot emitted by the serializer (`scenelet-1`, `branching-point-1`, etc.).
     - A short reminder that `associated_scenelet_ids` must match these ids exactly and that branching nodes reference `leads_to` scenelets.
   - `# Visual Design Document` with the persisted JSON/markdown from `CREATE_VISUAL_DESIGN`. Do not redact sections; the audio director needs the full character roster and environmental notes.
   - `# Task Instructions` reiterating that the output must be a single JSON object shaped like the system prompt’s `audio_design_document` example. This section should explicitly call out the referential integrity rules (character names, scenelet ids) so we can assert compliance in tests.
3. **Model Options** — reuse the shared Gemini client configuration (model, temperature, retry policy). No extra tuning unless future data proves necessary.

Snapshot the complete user prompt string in unit tests to catch formatting regressions.

## Response Contract & Validation
Gemini must return a single JSON object with the root key `audio_design_document`. Validation rules:

- **Presence:** Require `sonic_identity`, `character_voice_profiles` (array), and `music_and_ambience_cues` (array). Reject missing or null sections.
- **Sonic Identity:** Ensure `musical_direction` and `sound_effect_philosophy` are non-empty trimmed strings. Provide targeted errors mentioning the offending field.
- **Character Voice Profiles:**
  - Every `character_name` must exactly match (case-sensitive) the names in `visual_design_document.character_designs[*].character_name`. Collect duplicates and report all failures together.
  - `voice_description` and `tts_generation_prompt` must be non-empty strings with at least ~30 characters to guard against trivial outputs. Tune threshold in tests if needed.
  - Require a 1:1 mapping between visual design characters and voice profiles; flag omissions or extra profiles explicitly.
- **Music and Ambience Cues:**
  - `associated_scenelet_ids` must be a non-empty array whose members exactly match the story tree ids (`scenelet-#`). Reject unknown ids, repeated ids within a cue, or empty strings.
  - Ensure cues cover all scenelets that include dialogue. The validator should compute expected coverage from the story tree digest and surface missing coverage with the list of uncovered scenelets.
  - Require `music_generation_prompt` and `cue_description` to be non-empty. Optionally enforce keyword presence (tempo, instrumentation) via soft validation warnings logged for observability.
- **Structure & Types:** Ignore unknown properties for forward compatibility but never persist unvalidated structures.

Persist the validated object to `stories.audio_design_document` via the stories repository. The task should be idempotent by refusing to overwrite an existing audio design document unless reset tooling emerges later.

## Workflow Integration
- Extend the workflow task union with `CREATE_AUDIO_DESIGN`.
- Place the task after `CREATE_STORYBOARD` in both `runTask` (for direct invocation) and `runAllTasks`. Running it earlier is technically possible, but sequencing it last simplifies operator expectations and keeps musical work aligned with locked storyboards.
- Prerequisite checks:
  - Constitution present.
  - Scenelets exist.
  - Visual design document present.
  - `audio_design_document` empty.
- Execution flow:
  1. Load constitution, story tree snapshot, and visual design document.
  2. Build Gemini prompt and execute with injected client (stub vs real).
  3. Parse and validate response per rules above.
  4. Persist audio design document through `StoriesRepository.updateStoryArtifacts`.
  5. Emit metrics/logs capturing cue coverage counts and validation errors.
- Errors should surface as `AgentWorkflowError` variants so the CLI can relay actionable guidance.

## CLI Support
- Add `CREATE_AUDIO_DESIGN` to CLI task enums, help text, and validation.
- Ensure `run-all` schedules the task after storyboard generation.
- Stub mode:
  - Create deterministic Gemini fixtures under `agent-backend/fixtures/gemini/audio-design/` (e.g., `success.json`, `invalid-character.json`). The primary `success.json` must align with existing storyboard and visual design fixtures so `run-all --mode stub` completes without triggering validation errors.
  - Extend stub loader to return audio design fixtures when the system prompt path matches `audio_director.md`.
- Real mode should expose Gemini failures and validation errors without masking stack traces in debug logs. Include human-friendly summaries for referential integrity violations.

## Testing Strategy
- **Prompt Builder Tests** (`agent-backend/test/audioDesignPromptBuilder.test.ts`): verify section ordering, serializer integration, and inclusion of integrity reminders. Snapshot the assembled prompt.
- **Validator Tests** (`agent-backend/test/audioDesignResponseValidator.test.ts`): cover happy path, mismatched character names, missing cues, empty strings, unknown scenelet ids, and duplicate coverage.
- **Workflow Task Tests** (`agent-backend/test/audioDesignTask.test.ts`): enforce prerequisite checks, Gemini failure propagation, validation errors, duplicate-run prevention, and successful persistence.
- **Integration Tests** (`agent-backend/test/audioDesignIntegration.test.ts`): run the full task with stubbed Gemini, ensuring persistence and logging behave correctly. Include a test for `runAllTasks` sequencing.
- **CLI Tests** (`agent-backend/test/agentWorkflowCli.test.ts`): confirm CLI routing for `CREATE_AUDIO_DESIGN`, stub mode fixture wiring, and `run-all` end-to-end execution.
- **Repository Tests**: extend coverage for `StoriesRepository.updateStoryArtifacts` to assert audio design documents round-trip and remain untouched when unrelated artifacts update.

## OpenSpec Workflow
- Create a new change proposal (e.g., `add-audio-design-task`) under `openspec/changes/` capturing:
  - `proposal.md` summarizing scope and motivation.
  - `tasks.md` outlining a sequenced implementation checklist tied to this plan.
  - `specs/story-workflow/spec.md` delta adding audio design task requirements.
  - `specs/story-storage/spec.md` delta if additional persistence rules are needed (e.g., ensuring column presence or idempotency notes).
- Run `openspec validate <change-id> --strict` and resolve findings before requesting review.

## Deliverables
- Workflow, repository, and CLI updates that satisfy the forthcoming OpenSpec requirements for audio design.
- Gemini prompt builder and response validator modules with accompanying fixtures.
- Persisted audio design document accessible via the stories repository and aligned with visual design character naming.
- Updated developer documentation (this file) referenced in onboarding materials once shipped.
