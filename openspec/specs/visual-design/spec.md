# visual-design Specification

## Purpose
TBD - created by archiving change add-visual-design-task. Update Purpose after archive.
## Requirements
### Requirement: Assemble Visual Design Prompt
The visual design generator MUST combine the story constitution and a YAML-formatted interactive script digest into the Gemini request using `system_prompts/concept_artist_and_production_designer.md`.

#### Scenario: Prompt includes constitution and story tree YAML
- **GIVEN** a story with constitution markdown and an interactive script tree snapshot
- **WHEN** the visual design generator prepares the Gemini request
- **THEN** it MUST set the system prompt from `system_prompts/concept_artist_and_production_designer.md`
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

