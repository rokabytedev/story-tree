## ADDED Requirements
### Requirement: Assemble Visual Reference Prompt
The visual reference generator MUST build a Gemini request that combines the constitution, story tree snapshot, and visual design document using the Visual Reference Director system prompt.

#### Scenario: Prompt includes constitution, story tree YAML, and visual design
- **GIVEN** a story with a stored constitution, generated interactive script, and persisted visual design document
- **WHEN** the visual reference task prepares the Gemini request
- **THEN** it MUST load the system prompt from `system_prompts/create_visual_reference.md`
- **AND** it MUST render one user message that first prints the constitution markdown, then the YAML story tree snapshot labeled `Interactive Script Story Tree (YAML)`, and finally the full visual design document
- **AND** it MUST append task instructions that reiterate the required JSON output shape and referential integrity rules for character and environment names
- **AND** unit tests MUST snapshot the assembled user prompt so regressions in ordering or headings fail fast.

### Requirement: Validate Visual Reference Response
The visual reference task MUST validate the Gemini response before persisting it to ensure referential integrity and prompt completeness.

#### Scenario: Validator enforces character and environment coverage
- **GIVEN** Gemini returns a JSON object containing `visual_reference_package`
- **WHEN** the validator runs
- **THEN** it MUST confirm every `character_designs[*].character_name` from the visual design document appears exactly once in `character_model_sheets` with at least one `CHARACTER_MODEL_SHEET` entry whose `image_generation_prompt` is a non-empty string of sufficient descriptive length (e.g., ≥ 80 characters)
- **AND** it MUST ensure any additional character plates reuse the exact case-sensitive character names and include non-empty prompts
- **AND** it MUST confirm every `environment_designs[*].environment_name` appears in `environment_keyframes` with at least one keyframe prompt and that each prompt is non-empty and describes lighting or atmospheric context
- **AND** it MUST reject unknown names, missing sections, empty prompts, or malformed JSON with descriptive errors that cite the offending field names.

#### Scenario: Validator preserves structured flexibility
- **GIVEN** Gemini includes extra metadata fields under `visual_reference_package`
- **WHEN** the validator parses the payload
- **THEN** it MUST ignore unknown fields but retain the validated structure when persisting
- **AND** it MUST require the root key `visual_reference_package` to be present and shaped as an object, rejecting arrays or primitive values.

### Requirement: Persist Visual Reference Package
The visual reference task MUST persist the validated package on the story record and ensure idempotent workflow behavior.

#### Scenario: Visual reference persistence updates story artifacts
- **GIVEN** the validator returns a sanitized `visual_reference_package`
- **WHEN** the workflow task completes
- **THEN** it MUST call the stories repository to store the package in `stories.visual_reference_package`
- **AND** it MUST avoid overwriting an existing package unless explicit reset tooling runs
- **AND** it MUST return the stored artifact to callers alongside workflow status metadata.

#### Scenario: Prerequisite checks prevent reruns without required inputs
- **GIVEN** a workflow handle invokes `CREATE_VISUAL_REFERENCE`
- **WHEN** the story lacks a constitution, has no scenelets, lacks a visual design document, or already has a visual reference package
- **THEN** the task MUST throw a descriptive error without calling Gemini or mutating storage
- **AND** telemetry/logs MUST capture the reason so operators understand the failure mode.
