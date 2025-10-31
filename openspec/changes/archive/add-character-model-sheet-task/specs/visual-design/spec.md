# visual-design Specification Delta

## MODIFIED Requirements

### Requirement: Store Character Model Sheet Image Paths

The visual design document MUST support storing file paths for generated character model sheet images within each character design object.

#### Scenario: Character design includes model sheet image path field

- **GIVEN** a visual design document with character_designs array
- **WHEN** a character model sheet image is generated for a character
- **THEN** the corresponding character_designs entry MUST be updated with a character_model_sheet_image_path field
- **AND** the field value MUST be a relative path string in the format `<story-id>/visuals/characters/<character-id>/character-model-sheet.png`
- **AND** the field MUST be optional (undefined before image generation)
- **AND** the field MUST persist in the visual_design_document JSONB column without schema migration

#### Scenario: Image path update preserves existing character design data

- **GIVEN** a character_designs entry with existing fields (character_name, character_id, visual_description, etc.)
- **WHEN** the character_model_sheet_image_path field is added or updated
- **THEN** all existing character design fields MUST remain unchanged
- **AND** only the character_model_sheet_image_path field MUST be added or overwritten
- **AND** the update MUST be atomic per character

#### Scenario: Document update happens immediately after successful image generation

- **GIVEN** a character model sheet image has been successfully generated and saved to storage
- **WHEN** the image storage operation completes successfully
- **THEN** the visual_design_document MUST be updated with the image path immediately
- **AND** the database write MUST complete before processing the next character in batch mode
- **AND** the update MUST not be deferred or batched across multiple characters

#### Scenario: Failed image generation does not corrupt document

- **GIVEN** a character for which image generation fails (Gemini error or storage error)
- **WHEN** the error is caught and handled
- **THEN** the visual_design_document MUST NOT be modified for that character
- **AND** the existing character_model_sheet_image_path (if any) MUST remain unchanged
- **AND** other characters in a batch operation MUST continue processing normally

#### Scenario: Path field supports override and resume behavior

- **GIVEN** a character_designs entry with an existing character_model_sheet_image_path value
- **WHEN** the character model sheet task checks whether to generate an image
- **THEN** the presence of a truthy character_model_sheet_image_path MUST indicate an existing model sheet
- **AND** override=false MUST skip generation for this character
- **AND** override=true MUST regenerate and replace the path value
- **AND** the resume flag in batch mode MUST skip characters with truthy paths
