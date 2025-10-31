# environment-reference Specification

## Purpose

Generate high-fidelity environment reference images for story environments using structured prompts that combine visual design data with Environment Concept Artist role guidance to eliminate style drift.

## Requirements
### Requirement: Assemble Structured Environment Reference Prompt
The environment reference generator MUST build a Gemini request that combines global aesthetic data and environment-specific design data using a structured inline prompt format.

#### Scenario: Prompt includes Role directive and visual design data
- **GIVEN** a story with a persisted visual_design_document containing global_aesthetic and environment_designs
- **WHEN** the environment reference task prepares the Gemini request for an environment
- **THEN** it MUST construct a user prompt that begins with the Role and Core Directive sections verbatim from the plan specification
- **AND** it MUST append a JSON block containing the entire global_aesthetic object and the specific environment_design object for the target environment
- **AND** the JSON block MUST include environment_id, and detailed_description fields (color_tones, key_elements, overall_description, lighting_and_atmosphere)
- **AND** it MUST NOT use a system prompt (system instruction MUST be empty or undefined)
- **AND** unit tests MUST snapshot the assembled prompt to catch regressions in format

#### Scenario: Prompt uses exact template from plan specification
- **GIVEN** the plan document specifies an exact prompt template
- **WHEN** the prompt builder assembles the prompt
- **THEN** it MUST use the exact Role and Core Directive text specified in docs/019_visual_environment_plan.md lines 27-56
- **AND** it MUST NOT modify, improve, or paraphrase the template
- **AND** it MUST preserve the structure with Role heading, purpose statement, Core Directive heading, and three bullet points (Analyze, Construct, Omit)
- **AND** code reviews MUST verify template fidelity against the source specification

### Requirement: Generate Environment Reference Images with Correct Aspect Ratio
The environment reference task MUST generate images using the 16:9 aspect ratio as specified in the plan requirements.

#### Scenario: Image generation uses 16:9 aspect ratio
- **GIVEN** the GeminiImageClient supports multiple aspect ratios
- **WHEN** the environment reference task calls generateImage
- **THEN** it MUST pass aspectRatio: '16:9' in the ImageGenerationRequest
- **AND** the aspect ratio MUST be hard-coded (not configurable)
- **AND** the generated image MUST have dimensions consistent with 16:9 ratio
- **AND** integration tests MUST verify the aspect ratio of saved images

#### Scenario: Task reuses existing Gemini image client
- **GIVEN** the codebase includes GeminiImageClient from image-generation module
- **WHEN** the environment reference task needs to generate an image
- **THEN** it MUST use the existing createGeminiImageClient factory or injected client
- **AND** it MUST NOT create a new Gemini client implementation
- **AND** it MUST respect timeout and retry options passed through task dependencies

### Requirement: Support Batch and Single-Environment Generation Modes
The environment reference task MUST support generating images for all environments (batch mode) or a single target environment.

#### Scenario: Batch mode generates images for all environments
- **GIVEN** a story with multiple environment designs in visual_design_document
- **WHEN** the task is invoked without a targetEnvironmentId option
- **THEN** it MUST iterate through all environments in environment_designs array
- **AND** it MUST generate a reference image for each environment sequentially
- **AND** it MUST persist the image path to the database immediately after each successful generation
- **AND** it MUST continue processing remaining environments if one fails
- **AND** it MUST return a summary of successful, skipped, and failed generation counts

#### Scenario: Single mode targets specific environment by ID
- **GIVEN** a story with multiple environment designs
- **WHEN** the task is invoked with targetEnvironmentId option set
- **THEN** it MUST look up the environment design by environment_id field
- **AND** it MUST generate only one reference image for that environment
- **AND** if the environment_id is not found, it MUST throw an error listing available environment IDs
- **AND** it MUST ignore the --resume flag if present (single mode always attempts generation unless overridden by --override=false)

#### Scenario: Batch mode filters based on resume flag
- **GIVEN** a story with some environments that already have environment_reference_image_path set
- **WHEN** the task is invoked in batch mode with resume flag true
- **THEN** it MUST skip environments that have a non-empty environment_reference_image_path
- **AND** it MUST generate images only for environments without existing paths
- **AND** it MUST log each skipped environment in verbose mode
- **AND** the skip count MUST be included in the result summary

### Requirement: Control Regeneration with Override Flag
The environment reference task MUST respect the override flag to control whether existing reference images are regenerated.

#### Scenario: Override false skips environments with existing images
- **GIVEN** an environment design with a non-empty environment_reference_image_path
- **WHEN** the task processes that environment with override option false or undefined
- **THEN** it MUST skip image generation for that environment
- **AND** it MUST increment the skipped count in the result
- **AND** in verbose mode it MUST log the existing path that caused the skip

#### Scenario: Override true regenerates existing images
- **GIVEN** an environment design with an existing environment_reference_image_path
- **WHEN** the task processes that environment with override option true
- **THEN** it MUST generate a new reference image
- **AND** it MUST save the new image to the same file path (overwriting the old file)
- **AND** it MUST update environment_reference_image_path in the database (even though the value may be identical)
- **AND** it MUST NOT skip the environment

### Requirement: Persist Environment Reference Image Path
The environment reference task MUST persist the generated image path in the visual design document immediately after successful generation.

#### Scenario: Image path is saved immediately per environment
- **GIVEN** a successfully generated environment reference image saved to disk
- **WHEN** the image storage operation completes
- **THEN** the task MUST update the visual_design_document.environment_designs array
- **AND** it MUST set environment_reference_image_path on the specific environment design object
- **AND** it MUST call storiesRepository.updateStoryArtifacts with the updated visual_design_document
- **AND** the database update MUST complete before processing the next environment in batch mode
- **AND** if the database update fails, the task MUST throw an error including the generated image path

#### Scenario: Image path uses consistent relative format
- **GIVEN** a story ID and environment ID
- **WHEN** the task constructs the image save path
- **THEN** it MUST use the pattern `generated/<story-id>/visuals/environments/<environment-id>/environment-reference.png`
- **AND** the path MUST be relative to the public directory root
- **AND** the path MUST NOT include a sequence number suffix
- **AND** the path MUST use the environment_id field (not environment_name) for the directory name

#### Scenario: Storage failure prevents database update
- **GIVEN** image generation succeeds but file system storage fails
- **WHEN** the ImageStorageService throws an error
- **THEN** the task MUST NOT update environment_reference_image_path in the database
- **AND** the task MUST wrap the storage error with environment context
- **AND** in batch mode, the task MUST record the failure and continue with remaining environments

### Requirement: Validate Environment Reference Task Prerequisites
The environment reference task MUST validate that required data exists before attempting image generation.

#### Scenario: Task requires story to exist
- **GIVEN** an invalid or non-existent story ID
- **WHEN** the task is invoked
- **THEN** it MUST throw EnvironmentReferenceTaskError indicating the story was not found
- **AND** it MUST NOT attempt to call Gemini or storage services

#### Scenario: Task requires visual design document
- **GIVEN** a story record without a visual_design_document field
- **WHEN** the task loads the story
- **THEN** it MUST throw EnvironmentReferenceTaskError indicating visual design document is required
- **AND** the error message MUST suggest running CREATE_VISUAL_DESIGN first

#### Scenario: Task requires at least one environment design
- **GIVEN** a visual_design_document with an empty or missing environment_designs array
- **WHEN** the task validates the document
- **THEN** it MUST throw EnvironmentReferenceTaskError indicating no environments found
- **AND** it MUST NOT proceed to image generation

#### Scenario: Single mode requires valid environment ID
- **GIVEN** a targetEnvironmentId that does not match any environment_id in environment_designs
- **WHEN** the task attempts to find the target environment
- **THEN** it MUST throw EnvironmentReferenceTaskError listing available environment IDs
- **AND** the error message MUST include the invalid ID and the available IDs for reference

### Requirement: Log Verbose Generation Details
The environment reference task MUST support verbose logging to aid debugging and monitoring.

#### Scenario: Verbose mode logs assembled prompt
- **GIVEN** the task is invoked with verbose flag true
- **WHEN** the task assembles the structured prompt for an environment
- **THEN** it MUST log the complete prompt text via logger.debug
- **AND** it MUST log the aspectRatio and timeoutMs parameters
- **AND** it MUST NOT log binary image data

#### Scenario: Verbose mode logs generation timing
- **GIVEN** verbose flag is true
- **WHEN** the task calls Gemini to generate an image
- **THEN** it MUST log the start timestamp before generation
- **AND** it MUST log the completion timestamp and duration after generation
- **AND** it MUST log the image size in bytes

#### Scenario: Verbose mode logs file save paths
- **GIVEN** verbose flag is true and image storage succeeds
- **WHEN** the task saves the image to disk
- **THEN** it MUST log the full file path via logger.debug
- **AND** it MUST log the relative path that will be stored in the database

### Requirement: Handle Partial Batch Failures Gracefully
The environment reference task MUST collect errors during batch generation and provide a comprehensive summary rather than failing fast.

#### Scenario: Batch mode continues after individual failures
- **GIVEN** a batch generation where one environment fails during image generation
- **WHEN** the task processes the failing environment
- **THEN** it MUST catch the error and record it with environment context
- **AND** it MUST continue processing the next environment in the list
- **AND** it MUST NOT abort the entire batch operation

#### Scenario: Task returns summary with error details
- **GIVEN** batch mode completes with some successes and some failures
- **WHEN** the task returns its result
- **THEN** the result MUST include counts of generated, skipped, and failed environments
- **AND** the result MUST include an array of error objects with environment_id and error message
- **AND** callers MUST be able to identify which environments succeeded and which failed
- **AND** failed environments can be retried individually or with --resume flag

