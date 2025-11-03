# visual-design Specification

## Purpose
TBD - created by archiving change add-visual-design-task. Update Purpose after archive.
## Requirements
### Requirement: Assemble Visual Design Prompt
The visual design generator MUST combine the story constitution and a YAML-formatted interactive script digest into the Gemini request using `system_prompts/create_visual_design.md`.

#### Scenario: Prompt includes constitution and story tree YAML
- **GIVEN** a story with constitution markdown and an interactive script tree snapshot
- **WHEN** the visual design generator prepares the Gemini request
- **THEN** it MUST set the system prompt from `system_prompts/create_visual_design.md`
- **AND** it MUST render one user message that first contains the constitution markdown
- **AND** it MUST append an `Interactive Script Story Tree (YAML)` section whose content lists human-readable scenelet and branching ids (`scenelet-1`, `branching-point-1`, etc.), choice prompts, choice labels, and scenelet fields (`description`, `dialogue`, `shot_suggestions`)
- **AND** it MUST omit Supabase UUIDs or story ids from the payload
- **AND** it MUST avoid mutating the snapshot so deterministic tests can assert the payload.

### Requirement: Persist Visual Design Document
The visual design generator MUST validate the Gemini JSON response and store the resulting visual design document on the story record.

#### Scenario: Gemini success stores document
- **GIVEN** the generator receives a Gemini response that parses into an object with a `visual_design_document` property
- **WHEN** the visual design task completes
- **THEN** it MUST persist the JSON to `stories.visual_design_document` via the stories repository
- **AND** it MUST return the persisted document metadata to the caller.

#### Scenario: Gemini error surfaces descriptive failure
- **GIVEN** Gemini returns malformed JSON or omits `visual_design_document`
- **WHEN** the generator handles the response
- **THEN** it MUST throw an error that identifies the visual design operation and includes the raw response text with secrets removed
- **AND** it MUST avoid mutating the story record.

### Requirement: Store Environment Reference Image Path
The visual design document MUST support storing the file path to generated environment reference images for each environment design.

#### Scenario: Environment design includes optional reference image path field
- **GIVEN** the visual_design_document JSON schema stored in stories.visual_design_document
- **WHEN** the schema defines environment_designs array items
- **THEN** each environment design object MUST support an optional environment_reference_image_path string field
- **AND** the field MUST store the relative path from the public directory root (e.g., `generated/<story-id>/visuals/environments/<environment-id>/environment-reference.png`)
- **AND** the field MUST be optional to support environments without generated reference images yet
- **AND** TypeScript types MUST reflect this optional field in EnvironmentDesign interfaces

#### Scenario: Environment reference task updates image path after generation
- **GIVEN** a successfully generated environment reference image
- **WHEN** the CREATE_ENVIRONMENT_REFERENCE_IMAGE task completes image generation
- **THEN** the task MUST update the corresponding environment design object in visual_design_document
- **AND** the task MUST set environment_reference_image_path to the relative path of the saved PNG file
- **AND** the task MUST persist the updated visual_design_document immediately via the stories repository
- **AND** the task MUST handle concurrent updates safely if multiple environments are generated in sequence

#### Scenario: Visual design document creation initializes without reference image paths
- **GIVEN** the CREATE_VISUAL_DESIGN task generates a new visual_design_document
- **WHEN** the document is persisted to the database
- **THEN** the environment_designs array MUST NOT include environment_reference_image_path fields initially
- **AND** the field MUST only be added when CREATE_ENVIRONMENT_REFERENCE_IMAGE task runs

#### Scenario: UI consumers use reference image path for display
- **GIVEN** a story with generated environment reference images
- **WHEN** the UI fetches the visual_design_document
- **THEN** UI components MUST check for the presence of environment_reference_image_path
- **AND** if present, UI MUST construct the full URL by prepending the public URL base path
- **AND** if absent, UI MUST show appropriate placeholder or "generate" action button
- **AND** the path format MUST be consistent and predictable for URL construction

