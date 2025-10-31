# shot-image Specification Delta

## ADDED Requirements

### Requirement: Load Reference Images from Visual Design Document

The shot image generator MUST read character model sheet and environment reference image paths directly from the visual design document instead of constructing paths from patterns.

#### Scenario: Load character model sheet paths from visual design

- **GIVEN** a story with a visual_design_document containing character_designs array
- **AND** a shot references characters via referencedDesigns.characters array
- **WHEN** the shot image task prepares reference images
- **THEN** it MUST look up each character_id in the character_designs array
- **AND** it MUST read the character_model_sheet_image_path field from the matching character design
- **AND** it MUST skip characters where character_model_sheet_image_path is undefined, null, or empty string
- **AND** it MUST construct the full file system path by joining the base public path with the relative path
- **AND** it MUST load the image file into a buffer for Gemini reference

#### Scenario: Load environment reference paths from visual design

- **GIVEN** a story with a visual_design_document containing environment_designs array
- **AND** a shot references environments via referencedDesigns.environments array
- **WHEN** the shot image task prepares reference images
- **THEN** it MUST look up each environment_id in the environment_designs array
- **AND** it MUST read the environment_reference_image_path field from the matching environment design
- **AND** it MUST skip environments where environment_reference_image_path is undefined, null, or empty string
- **AND** it MUST construct the full file system path by joining the base public path with the relative path
- **AND** it MUST load the image file into a buffer for Gemini reference

#### Scenario: Prioritize characters over environments for image limits

- **GIVEN** a shot references both characters and environments
- **AND** the total number of available images exceeds the maxImages limit (default 5)
- **WHEN** the shot image task selects reference images
- **THEN** it MUST include all available character model sheets first
- **AND** it MUST fill remaining slots with environment reference images
- **AND** it MUST enforce the maxImages limit across both types

#### Scenario: Fail when referenced design is missing image path

- **GIVEN** a shot references a character or environment via referencedDesigns
- **AND** the corresponding design object exists in visual_design_document
- **BUT** the image path field (character_model_sheet_image_path or environment_reference_image_path) is not set or is an empty string
- **WHEN** the shot image task prepares reference images
- **THEN** it MUST throw a descriptive error
- **AND** the error message MUST identify the character or environment ID
- **AND** the error message MUST instruct the user to run CREATE_CHARACTER_MODEL_SHEET or CREATE_ENVIRONMENT_REFERENCE_IMAGE
- **AND** shot generation MUST NOT proceed

#### Scenario: Validate file existence for all referenced images

- **GIVEN** all referenced designs have non-empty image path fields
- **WHEN** the shot image task attempts to load the images
- **THEN** it MUST check if each file exists at the full path (base public path + relative path)
- **AND** if any file does not exist, it MUST throw a descriptive error
- **AND** the error MUST include the full path to the missing file
- **AND** shot generation MUST halt immediately
- **AND** no images MUST be generated if any referenced image is missing

## MODIFIED Requirements

### Requirement: Reference Image Recommender Supports Visual Design Document

The reference image recommender MUST accept a visual design document as an alternative input source for determining reference image paths.

#### Scenario: Recommender accepts visual design document parameter

- **GIVEN** the recommendReferenceImages function
- **WHEN** called with a visualDesignDocument parameter
- **THEN** it MUST use the document to read character_model_sheet_image_path from character_designs
- **AND** it MUST use the document to read environment_reference_image_path from environment_designs
- **AND** it MUST NOT construct paths using hardcoded patterns
- **AND** it MUST return recommendations with the paths read from the document

#### Scenario: Recommender maintains backward compatibility without visual design document

- **GIVEN** the recommendReferenceImages function
- **WHEN** called without a visualDesignDocument parameter
- **THEN** it MUST fall back to the existing behavior of constructing paths from patterns
- **AND** it MUST use the hardcoded filenames (character-model-sheet-1.png, keyframe_1.png)
- **AND** all existing tests using the old approach MUST continue to pass

## REMOVED Requirements

None. This change maintains backward compatibility by adding new behavior rather than removing existing functionality.
