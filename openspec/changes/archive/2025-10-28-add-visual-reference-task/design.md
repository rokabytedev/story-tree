## Overview
The visual reference task bridges the gap between approved visual design canon and the concrete image generation prompts downstream teams require. It sits between the existing visual design and audio design tasks. The workflow will pull read-only artifacts (constitution markdown, story tree YAML snapshot, visual design document) and feed them into Gemini using the Generative Art Director system prompt. The task persists Gemini’s JSON response to `stories.visual_reference_package` after strict validation.

## Data Flow
1. Workflow task loads the story via the stories repository to guarantee the constitution, visual design document, and prior scenelets are present. It short-circuits if a visual reference package already exists.
2. Prompt builder retrieves the YAML snapshot from the storage layer, then assembles a markdown user prompt with sections for constitution, story tree, visual design document, and task instructions. The builder captures deterministic formatting to keep validation predictable and snapshot friendly.
3. Gemini executes with the (renamed) `visual_reference_director` system prompt. Stub mode supplies fixtures for tests and CLI runs.
4. Response validator parses the JSON, verifies referential integrity, ensures action shots include base prompt context, and confirms at least one `CHARACTER_MODEL_SHEET` per character. Failures throw typed errors consumed by the workflow.
5. On success, the workflow persists the validated package to Supabase using `StoriesRepository.updateStoryArtifacts` and emits telemetry for downstream observability.

## Validation Strategy
- Characters: require a 1:1 match with visual design character roster (case-sensitive). Each character must expose at least one `CHARACTER_MODEL_SHEET` plate plus optional action shots whose prompts incorporate the base component.
- Environments: require coverage for every environment specified in the visual design document, each with ≥1 keyframe prompt. Keyframes must declare lighting/time-of-day context.
- Prompts: enforce non-empty strings; reject prompts shorter than a configured threshold to avoid low-information outputs. All entries must include the character/environment name verbatim.
- Structure: tolerate additive fields but ensure the root key `visual_reference_package` is present and of the expected shape.

## Naming Adjustment
To reduce confusion, the system prompt file will be surfaced as `system_prompts/visual_reference_director.md`. The existing `generative_art_director.md` content will be preserved verbatim—either by renaming the file or keeping a thin wrapper that re-exports the same text—so historical references continue to work. All code paths and documentation will switch to the new name.

## Testing
- Prompt builder snapshot tests assert that the YAML snapshot, constitution, and visual design data land in the correct order with stable headings.
- Validator tests cover happy path, missing character or environment coverage, mismatched names, missing `CHARACTER_MODEL_SHEET`, empty prompts, and duplicate references.
- Workflow task tests verify prerequisite enforcement, persistence behavior, Gemini failure propagation, and idempotency.
- CLI integration tests ensure stub mode pipelines succeed with new fixtures.
