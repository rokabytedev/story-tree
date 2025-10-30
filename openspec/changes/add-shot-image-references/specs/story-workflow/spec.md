## ADDED Requirements

### Requirement: Preserve Referenced Designs from Shot Production
The shot production response parser MUST extract and preserve the `referenced_designs` field from Gemini's storyboard entries to enable reference image lookup.

#### Scenario: Extract referenced designs from Gemini response
- **GIVEN** Gemini returns a shot with `storyboard_entry.referenced_designs` containing character and environment IDs
- **WHEN** the shot production parser processes the response
- **THEN** it MUST extract the `referenced_designs` object
- **AND** it MUST validate that `characters` is an array of strings (or absent)
- **AND** it MUST validate that `environments` is an array of strings (or absent)
- **AND** the parsed storyboard MUST include the `referencedDesigns` field

#### Scenario: Handle missing referenced designs gracefully
- **GIVEN** Gemini returns a shot without `storyboard_entry.referenced_designs`
- **WHEN** the shot production parser processes the response
- **THEN** it MUST set `referencedDesigns` to undefined or omit the field
- **AND** it MUST NOT throw errors for missing reference design data

#### Scenario: Persist referenced designs in storyboard payload
- **GIVEN** the parser has extracted `referencedDesigns` from a shot
- **WHEN** the shot is saved to the database
- **THEN** the `storyboard_payload` JSONB column MUST contain the `referencedDesigns` object
- **AND** the structure MUST preserve character and environment ID arrays

### Requirement: Recommend Reference Images for Shots
The shot image generation task MUST automatically identify and recommend reference images based on the shot's `referenced_designs` metadata.

#### Scenario: Recommend character model sheets
- **GIVEN** a shot references characters via `storyboard_entry.referenced_designs.characters`
- **WHEN** the reference image recommender runs
- **THEN** it MUST locate the visual reference package for the story
- **AND** for each character ID, it MUST find the corresponding character model sheet entry
- **AND** it MUST select the first `CHARACTER_MODEL_SHEET` type plate as the reference image
- **AND** it MUST return the file path following the pattern `<story-id>/visuals/characters/<character-id>/character-model-sheet-1.png`

#### Scenario: Recommend environment keyframes
- **GIVEN** a shot references environments via `storyboard_entry.referenced_designs.environments`
- **WHEN** the reference image recommender runs
- **THEN** it MUST locate the visual reference package for the story
- **AND** for each environment ID, it MUST find the corresponding environment keyframes entry
- **AND** it MUST select the first keyframe if it exists (name pattern: `keyframe_1.png`)
- **AND** it MUST return the file path following the pattern `<story-id>/visuals/environments/<environment-id>/keyframe_1.png`

#### Scenario: Prioritize characters when limit exceeded
- **GIVEN** a shot references multiple characters and environments
- **AND** the total number of reference images exceeds the upload limit (5 images)
- **WHEN** the reference image recommender runs
- **THEN** it MUST prioritize character model sheets over environment keyframes
- **AND** it MUST include all character images first
- **AND** it MUST fill remaining slots with environment images
- **AND** the total number of returned images MUST NOT exceed 5

#### Scenario: Handle missing reference images
- **GIVEN** a shot references a character or environment
- **AND** the corresponding reference image file does not exist on disk
- **WHEN** the reference image recommender validates the paths
- **THEN** it MUST throw a descriptive error identifying the missing character or environment
- **AND** the error MUST include the expected file path that was not found
- **AND** shot generation MUST NOT proceed with incomplete reference images

### Requirement: Upload Reference Images to Gemini
The shot image generation task MUST upload recommended reference images to Gemini alongside the generation prompt.

#### Scenario: Upload reference images with shot generation request
- **GIVEN** the reference image recommender returns a list of image paths
- **WHEN** the Gemini image client generates a shot image
- **THEN** it MUST read each reference image file from disk
- **AND** it MUST convert each image to base64 inline data
- **AND** it MUST include the images as parts in the user message before the text prompt
- **AND** the Gemini API request MUST include both reference images and the generation prompt

#### Scenario: Log reference images in verbose mode
- **GIVEN** the shot image generation task runs with `--verbose` flag enabled
- **WHEN** reference images are uploaded for a shot
- **THEN** the logger MUST output a message listing each reference image
- **AND** the message MUST include the shot identifier (scenelet ID and shot index)
- **AND** for each image, the message MUST include the type (CHARACTER or ENVIRONMENT), the ID, and the file path
- **AND** the log format MUST be: `[Shot <scenelet-id> #<index>] Using reference images:\n  - <TYPE>: <id> -> <path>`

#### Scenario: Generate shot images without references when not available
- **GIVEN** a shot has no `referenced_designs` metadata (legacy shot or empty references)
- **WHEN** the shot image generation task runs
- **THEN** it MUST proceed with generation using only the text prompt
- **AND** it MUST NOT attempt to upload reference images
- **AND** it MUST NOT fail due to missing reference image data
