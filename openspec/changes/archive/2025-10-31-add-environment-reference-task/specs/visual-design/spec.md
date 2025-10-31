# visual-design Specification Delta

## MODIFIED Requirements

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
