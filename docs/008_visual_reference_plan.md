# Visual Reference Task Plan

## Goal
Introduce a `CREATE_VISUAL_REFERENCE` workflow task that consumes the story constitution, interactive script snapshot, and visual design document to produce a validated `visual_reference_package` JSON artifact via Gemini. The artifact will catalog character model sheets, contextual action shots, and environment keyframes so downstream image generation stays visually consistent.

## Inputs & Prerequisites
- Constitution markdown stored on the story record (`stories.story_constitution`).
- Interactive script scenelets persisted in Supabase and exposed through the existing story tree snapshot serializer, providing deterministic `scenelet-#` and `branching-point-#` identifiers.
- Visual design document stored in `stories.visual_design_document` with complete character and environment definitions.
- System prompt content found in `system_prompts/create_visual_reference.md` (identical to the previous Generative Art Director prompt).

The task may only execute once all three artifacts exist and `stories.visual_reference_package` is empty.

## Gemini Prompt Assembly
1. **System Prompt** — load `system_prompts/create_visual_reference.md` verbatim (identical content to the existing Generative Art Director prompt).
2. **User Prompt** — construct a single markdown document with sections in this order:
   - `# Story Constitution` containing the raw constitution markdown.
   - `# Interactive Script Story Tree (YAML)` containing the YAML snapshot emitted by the story tree serializer.
   - `# Visual Design Document` containing the persisted visual design document (do not redact sections).
   - `# Task Instructions` reiterating the JSON contract, case-sensitive name requirements, the need for at least one `CHARACTER_MODEL_SHEET` per character, and expectations around lighting/atmosphere notes for environments.
3. **Model Options** — reuse the shared Gemini client settings (model name, temperature, retry policy). No additional tuning is planned.

Snapshot the fully rendered user prompt in unit tests to catch any formatting regressions.

## Response Contract & Validation
The Gemini response must be a single JSON object with a top-level `visual_reference_package`. Validation rules:
- **Structure Presence** — reject responses missing `visual_reference_package` or containing non-object payloads.
- **Character Coverage** — every `visual_design_document.character_designs[*].character_name` must appear exactly once in `character_model_sheets`. Each sheet must include:
  - At least one `reference_plates[*]` entry where `type === "CHARACTER_MODEL_SHEET"`.
  - Non-empty `image_generation_prompt` strings (≥ 80 characters by default).
  - Additional plates may exist (e.g., action shots) but must reuse the exact case-sensitive `character_name` and contain descriptive prompts.
- **Environment Coverage** — every `visual_design_document.environment_designs[*].environment_name` must appear in `environment_keyframes` with ≥ 1 keyframe. Prompts must describe lighting or atmosphere and be non-empty.
- **Unknown Entities** — reject characters or environments that are not defined in the visual design document.
- **Prompt Quality** — trim whitespace, disallow empty strings, and optionally log warnings for prompts lacking key descriptive phrases while still treating them as errors in tests.
- **Error Reporting** — surface violations with actionable field-level messages so operators can nudge Gemini fixtures or real responses quickly.

Persist the sanitized JSON exactly as stored to avoid mutating Gemini’s structure beyond validation adjustments.

## Workflow Integration
- Extend the workflow task registry with `CREATE_VISUAL_REFERENCE` positioned between `CREATE_VISUAL_DESIGN` and `CREATE_AUDIO_DESIGN`.
- Prerequisite checks must confirm the story has a constitution, scenelets, and a visual design document, and that no visual reference package currently exists.
- Successful runs persist the package via `StoriesRepository.updateStoryArtifacts` and return the stored artifact alongside workflow status metadata.
- `runAllTasks` sequences should now execute: constitution → interactive script → visual design → visual reference → audio design → shot production.

## CLI & Fixtures
- Add `CREATE_VISUAL_REFERENCE` to CLI enums, help text, and validation.
- Ensure `run-task` supports stub and live modes. Stub mode should load deterministic fixtures under a new `fixtures/gemini/visual-reference/` directory.
- Update `run-all --mode stub` to include the visual reference task and ensure fixtures align with visual design/audio design data to avoid validation failures.
- Provide fixture variants for common validation errors (missing character, empty prompt) to support tests.

## Repository & Persistence
- Stories repository must expose `visualReferencePackage` when fetching stories and allow updates via `updateStoryArtifacts` without clobbering other artifacts.
- Add unit tests covering create/update flows that include the visual reference package to guard against serialization regressions.

## Testing Strategy
- **Prompt Builder Tests** — snapshot the assembled Gemini user prompt.
- **Validator Tests** — cover happy path plus mismatched names, missing `CHARACTER_MODEL_SHEET`, empty prompts, missing environments, and extra unknown names.
- **Workflow Task Tests** — enforce prerequisites, verify idempotency, and ensure Gemini/validation failures bubble up with descriptive errors.
- **CLI Tests** — assert stub mode routing works for `CREATE_VISUAL_REFERENCE` and that `run-all` includes the new task.
- **Integration Tests** — run the workflow in stub mode end-to-end to guarantee artifacts persist in Supabase (using test doubles).

## OpenSpec Workflow
- Change proposal lives under `openspec/changes/add-visual-reference-task/` with deltas for the new `visual-reference` capability plus workflow and repository updates.
- Run `openspec validate add-visual-reference-task --strict` before requesting review.

## Open Questions
- Should the validator enforce minimum counts for contextual action shots or environment variations beyond one per entity? (Initial scope sticks to ≥1 but leaves room for future tightening.)
- Do we need retry logic or auto-healing for Gemini failures, or will manual reruns via CLI suffice for now?
- Confirm whether downstream tooling expects additional metadata (e.g., palette tags) so we do not over-constrain prompt structure prematurely.
