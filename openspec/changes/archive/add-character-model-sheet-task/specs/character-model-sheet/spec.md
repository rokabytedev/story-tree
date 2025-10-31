# character-model-sheet Specification

## Purpose

Generate structured character model sheet reference images that combine detailed layout specifications with character-specific visual design data to eliminate style drift.

## ADDED Requirements

### Requirement: Build Structured Model Sheet Prompt

The character model sheet generator MUST construct a structured prompt that combines layout specifications, style constraints, and character-specific visual design data.

#### Scenario: Prompt uses exact template from plan document

- **GIVEN** a request to generate a character model sheet image
- **WHEN** the prompt builder assembles the generation request
- **THEN** the prompt MUST use the exact template specified in `docs/018_visual_reference_image_structured_prompt_plan.md`
- **AND** the prompt MUST begin with: "Character model sheet, character design sheet, concept art for animation, professional production art."
- **AND** the prompt MUST include "A 3-row grid layout."
- **AND** the prompt MUST specify: "**Top row:** Full body character turnaround in a T-pose. Clean orthographic views showing front, left side, right side, and back."
- **AND** the prompt MUST specify: "**Middle row:** Four headshots demonstrating key facial expressions: neutral, happy, sad, angry."
- **AND** the prompt MUST specify: "**Bottom row:** Four dynamic action poses: a ready stance, a walking pose, a running pose, and a jumping pose."
- **AND** the prompt MUST specify: "**Style:** Clean digital painting, detailed character render, full color, clear lines."
- **AND** the prompt MUST specify: "**Lighting & Background:** Bright, even studio lighting with soft shadows, set against a solid neutral gray background for maximum clarity."
- **AND** the prompt MUST specify: "**Constraint:** The image must not contain any text, letters, numbers, annotations, or watermarks. Purely visual with no typography."
- **AND** the prompt builder MUST NOT modify, improve, or reinvent this template
- **AND** the template MUST be a literal string constant (not loaded from a file)

#### Scenario: Prompt embeds global aesthetic from visual design document

- **GIVEN** a visual design document containing a global_aesthetic object with visual_style and master_color_palette
- **WHEN** the prompt builder processes the document
- **THEN** it MUST extract the entire global_aesthetic object
- **AND** it MUST serialize the object to JSON format
- **AND** it MUST embed the JSON in the prompt under a clearly labeled section
- **AND** it MUST preserve all nested fields without modification

#### Scenario: Prompt embeds character design data

- **GIVEN** a visual design document with character_designs array and a target character_id
- **WHEN** the prompt builder looks up the target character
- **THEN** it MUST find the character_designs entry where character_id matches the target
- **AND** it MUST extract the entire character design object for that character
- **AND** it MUST serialize the object to JSON format
- **AND** it MUST embed the JSON in the prompt under a clearly labeled section
- **AND** it MUST preserve all character-specific fields (character_name, visual_description, personality_notes, etc.)

#### Scenario: Prompt assembly fails for missing character

- **GIVEN** a target character_id that does not exist in character_designs array
- **WHEN** the prompt builder attempts to look up the character
- **THEN** it MUST throw a descriptive error indicating the character was not found
- **AND** the error MUST list available character IDs for debugging

### Requirement: Generate Model Sheet Image with 1:1 Aspect Ratio

The character model sheet generator MUST produce square images suitable for model sheet layouts using the Gemini image generation API.

#### Scenario: Image generation uses 1:1 aspect ratio

- **GIVEN** an assembled structured prompt for a character model sheet
- **WHEN** the task invokes the Gemini image client
- **THEN** the request MUST specify aspectRatio='1:1'
- **AND** the request MUST NOT use the default 16:9 aspect ratio
- **AND** the generated image MUST be square (equal width and height)

#### Scenario: Image generation includes no system prompt

- **GIVEN** a character model sheet generation request
- **WHEN** calling the Gemini image client
- **THEN** the request MUST include only the userPrompt field
- **AND** the request MUST NOT include a systemInstruction field
- **AND** all instructions MUST be contained in the inline userPrompt

#### Scenario: Image generation reuses existing Gemini client

- **GIVEN** the character model sheet task dependencies
- **WHEN** the task needs to generate an image
- **THEN** it MUST use the shared GeminiImageClient from image-generation module
- **AND** it MUST NOT create a new Gemini client implementation
- **AND** it MUST respect configured timeout and retry options

### Requirement: Persist Model Sheet Images to Filesystem

The character model sheet generator MUST save generated images to a predictable filesystem location without sequence numbers.

#### Scenario: Image path follows fixed naming convention

- **GIVEN** a generated model sheet image for a character in a story
- **WHEN** determining the storage path
- **THEN** the path MUST follow the format `<story-id>/visuals/characters/<character-id>/character-model-sheet.png`
- **AND** the filename MUST be exactly `character-model-sheet.png` (no sequence numbers)
- **AND** the path MUST be relative to the public generated assets directory
- **AND** the task MUST create parent directories if they don't exist

#### Scenario: Image storage uses existing service

- **GIVEN** a Buffer containing PNG image data from Gemini
- **WHEN** the task needs to persist the image
- **THEN** it MUST delegate to the ImageStorageService from image-generation module
- **AND** it MUST pass the story ID, category ('visuals/characters/<character-id>'), and filename
- **AND** it MUST NOT implement new filesystem logic

#### Scenario: Storage failure prevents database update

- **GIVEN** an image generation that succeeds but storage operation fails
- **WHEN** the storage error is caught
- **THEN** the task MUST throw a CharacterModelSheetTaskError wrapping the storage error
- **AND** the task MUST NOT update the visual_design_document with an image path
- **AND** the error message MUST identify the character and indicate storage failure

### Requirement: Update Visual Design Document with Image Paths

The character model sheet generator MUST persist image paths in the visual design document immediately after successful generation.

#### Scenario: Path is written immediately after image storage succeeds

- **GIVEN** a character model sheet image successfully saved to filesystem
- **WHEN** the storage operation returns the saved path
- **THEN** the task MUST immediately update the visual_design_document via the stories repository
- **AND** the update MUST set character_model_sheet_image_path on the matching character_designs entry
- **AND** the update MUST complete before processing the next character in batch mode
- **AND** the update MUST be atomic (single database write per character)

#### Scenario: Database update preserves other document fields

- **GIVEN** a visual_design_document with existing global_aesthetic, character_designs, and environment_designs
- **WHEN** updating a character's model sheet image path
- **THEN** only the target character's character_model_sheet_image_path field MUST change
- **AND** all other fields in the document MUST remain unchanged
- **AND** other characters in the character_designs array MUST be unaffected

#### Scenario: Batch mode persists each character independently

- **GIVEN** a batch operation generating model sheets for 5 characters
- **WHEN** the 3rd character's image is generated and stored successfully
- **THEN** the database MUST be updated with that character's path before generating the 4th image
- **AND** if generation fails on the 4th character, the 3rd character's path MUST already be persisted
- **AND** the task MUST continue with the 5th character after a failure

### Requirement: Support Batch and Single-Character Modes

The character model sheet generator MUST support generating images for all characters (batch mode) or a single targeted character.

#### Scenario: Batch mode generates images for all characters

- **GIVEN** a story with 3 characters in the visual design document
- **WHEN** the task is invoked without a targetCharacterId parameter
- **THEN** it MUST iterate over all entries in character_designs array
- **AND** it MUST generate a model sheet image for each character that needs one
- **AND** it MUST persist each image path immediately after generation
- **AND** it MUST return a count of successfully generated images

#### Scenario: Single-character mode targets specific character

- **GIVEN** a task invocation with targetCharacterId='wizard-merlin'
- **WHEN** the task executes
- **THEN** it MUST generate an image only for the character with character_id='wizard-merlin'
- **AND** it MUST skip all other characters in the character_designs array
- **AND** it MUST return a count of 1 (or 0 if skipped due to override flag)

#### Scenario: Single-character mode fails for unknown character

- **GIVEN** a task invocation with targetCharacterId='unknown-hero'
- **WHEN** no character in character_designs has character_id='unknown-hero'
- **THEN** the task MUST throw a descriptive error before any image generation
- **AND** the error MUST list the available character IDs

### Requirement: Respect Override and Resume Flags

The character model sheet generator MUST support idempotent generation through override and resume controls.

#### Scenario: Override false skips existing images

- **GIVEN** a character with character_model_sheet_image_path='story-1/visuals/characters/hero/character-model-sheet.png'
- **WHEN** the task runs with override=false (default)
- **THEN** it MUST skip image generation for this character
- **AND** it MUST log a debug message indicating the skip
- **AND** the generation count MUST not include this character

#### Scenario: Override true regenerates existing images

- **GIVEN** a character with an existing character_model_sheet_image_path
- **WHEN** the task runs with override=true
- **THEN** it MUST generate a new image for this character
- **AND** it MUST save the new image to the same path (overwriting the old file)
- **AND** it MUST update the visual_design_document (even though the path value is unchanged)
- **AND** the generation count MUST include this character

#### Scenario: Resume flag enables incremental batch generation

- **GIVEN** a batch mode task invocation with resume=true
- **WHEN** processing a character with an existing character_model_sheet_image_path
- **THEN** the task MUST skip that character (equivalent to override=false)
- **AND** when processing a character without a path, it MUST generate the image
- **AND** this MUST enable safe re-running of batch operations after partial failures

#### Scenario: Resume flag is ignored in single-character mode

- **GIVEN** a task invocation with both targetCharacterId and resume=true
- **WHEN** the task validates parameters
- **THEN** it MUST either ignore the resume flag or log a warning
- **AND** the override flag MUST take precedence in single-character mode

### Requirement: Handle Errors Gracefully in Batch Mode

The character model sheet generator MUST continue processing remaining characters after individual failures and report comprehensive error summaries.

#### Scenario: Single character failure does not stop batch

- **GIVEN** a batch operation for 3 characters where the 2nd character's generation fails
- **WHEN** the Gemini client throws an error for the 2nd character
- **THEN** the task MUST catch the error and log it with character context
- **AND** the task MUST continue processing the 3rd character
- **AND** the task MUST collect all errors encountered during the batch
- **AND** the final result MUST include a count of successful generations and a list of failures

#### Scenario: Gemini errors include character context

- **GIVEN** an image generation failure for character 'wizard-merlin'
- **WHEN** wrapping the Gemini API error
- **THEN** the error message MUST include the character_id or character_name
- **AND** the error MUST preserve the original error as the cause
- **AND** the error MUST be an instance of CharacterModelSheetTaskError

#### Scenario: Storage errors include character context

- **GIVEN** a storage failure when saving the image for character 'knight-arthur'
- **WHEN** wrapping the storage error
- **THEN** the error message MUST include the character_id and target file path
- **AND** the error MUST indicate that image generation succeeded but storage failed
- **AND** the visual_design_document MUST NOT be updated for this character

### Requirement: Log Detailed Request Information in Verbose Mode

The character model sheet generator MUST log detailed Gemini request information when verbose logging is enabled, excluding binary image data.

#### Scenario: Verbose flag logs assembled prompt

- **GIVEN** a task invocation with verbose logging enabled (logger supports debug level)
- **WHEN** generating a character model sheet image
- **THEN** the task MUST log the complete assembled prompt before sending to Gemini
- **AND** the log entry MUST include the character_id being processed
- **AND** the log MUST show the full prompt text including the JSON data block

#### Scenario: Verbose flag logs request parameters

- **GIVEN** verbose logging is enabled
- **WHEN** calling the Gemini image client
- **THEN** the task MUST log the request parameters (aspectRatio='1:1', timeout, retry settings)
- **AND** the task MUST log generation start timestamp
- **AND** the task MUST log generation completion timestamp

#### Scenario: Verbose mode excludes binary image data

- **GIVEN** verbose logging is enabled
- **WHEN** the Gemini client returns image data as a Buffer
- **THEN** the task MUST NOT log the binary image data to console
- **AND** the task MUST log only metadata (size in bytes, mime type if available)
- **AND** the task MUST log the saved file path after successful storage

#### Scenario: Non-verbose mode uses minimal logging

- **GIVEN** verbose logging is disabled (default behavior)
- **WHEN** generating character model sheets
- **THEN** the task MUST log only summary information (character count, success/failure counts)
- **AND** the task MUST NOT log the full prompt text
- **AND** the task MUST NOT log detailed request parameters
