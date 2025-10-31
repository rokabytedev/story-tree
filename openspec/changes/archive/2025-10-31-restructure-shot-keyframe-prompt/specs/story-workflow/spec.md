# story-workflow Delta Specification

## MODIFIED Requirements

### Requirement: Schedule Shot Production Task
The shot production task MUST generate shots with enhanced storyboard entries containing explicit design references and structured audio/narrative data instead of flat dialogue arrays.

#### Scenario: Shot director produces referenced_designs field
- **GIVEN** the shot production task runs for a scenelet
- **WHEN** Gemini returns the shot storyboard entry
- **THEN** it MUST include a `referenced_designs` object with `characters` and `environments` string arrays
- **AND** the character IDs MUST match `character_id` values from the visual design document
- **AND** the environment IDs MUST match `environment_id` values from the visual design document.

#### Scenario: Shot director produces audio_and_narrative field
- **GIVEN** the shot production task runs for a scenelet with dialogue
- **WHEN** Gemini returns the shot storyboard entry
- **THEN** it MUST include an `audio_and_narrative` array instead of a flat `dialogue` array
- **AND** each entry MUST have `type` field with value "monologue" or "dialogue"
- **AND** monologue entries MUST have `source` field set to "narrator"
- **AND** dialogue entries MUST have `source` field set to a valid `character_id` from the visual design document
- **AND** each entry MUST have a `line` field containing the text with performance notes in parentheticals.

#### Scenario: Shot production validates new storyboard structure
- **GIVEN** Gemini returns a shot production response
- **WHEN** the parser validates the storyboard entry
- **THEN** it MUST reject entries missing the `referenced_designs` object
- **AND** it MUST reject entries missing the `audio_and_narrative` array
- **AND** it MUST reject audio entries with invalid `type` values
- **AND** it MUST reject dialogue entries where `source` does not match a character_id in the visual design document
- **AND** it MUST reject monologue entries where `source` is not "narrator".

## ADDED Requirements

### Requirement: Assemble Key Frame Prompts from Storyboard Artifacts
The shot image generation task MUST assemble key frame prompts directly from storyboard metadata, visual design, and audio design documents instead of using pre-generated prompt strings.

#### Scenario: Image prompt assembly filters design assets
- **GIVEN** a shot record with `referenced_designs` containing specific character and environment IDs
- **WHEN** the key frame prompt assembler runs
- **THEN** it MUST extract `global_aesthetic` (visual_style and master_color_palette) from the visual design document
- **AND** it MUST filter `character_designs` to include only those with `character_id` matching the shot's `referenced_designs.characters`
- **AND** it MUST filter `environment_designs` to include only those with `environment_id` matching the shot's `referenced_designs.environments`
- **AND** the assembled prompt MUST combine the filtered design data with the shot's storyboard metadata.

#### Scenario: Image prompt excludes audio narrative
- **GIVEN** a shot record with an `audio_and_narrative` field
- **WHEN** the key frame prompt assembler runs
- **THEN** it MUST exclude the `audio_and_narrative` field from the assembled prompt sent to image generation
- **AND** it MUST include all other storyboard fields (framing_and_angle, composition_and_content, character_action_and_emotion, camera_dynamics, lighting_and_atmosphere, continuity_notes, referenced_designs).

#### Scenario: Image generation uses assembled prompt object
- **GIVEN** an assembled key frame prompt object
- **WHEN** the shot image task calls Gemini image generation
- **THEN** it MUST serialize the assembled prompt object to JSON
- **AND** it MUST pass the JSON as the `userPrompt` parameter
- **AND** it MUST use the existing `visual_renderer.md` system prompt without modification
- **AND** it MUST load reference images based on the `referenced_designs` character and environment IDs.
