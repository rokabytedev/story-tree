## MODIFIED Requirements
### Requirement: Display Character Reference Images
The Visual tab MUST display character design data from the visual design document as curated profile cards.

#### Scenario: User views character design card
- **GIVEN** a story has a `visualDesignDocument` with at least one entry in `character_designs`
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST show a "Characters" section containing one card per character design
- **AND** each card MUST render a single primary image sourced from `character_model_sheet_image_path` (after normalizing relative paths to `/generated/...`)
- **AND** when the image path is missing, the card MUST display a placeholder illustration and helper text indicating the model sheet is not generated yet
- **AND** metadata blocks MUST present the character role plus detailed description fields (attire, physique, facial features) with readable labels rather than raw JSON
- **AND** the implementation MUST NOT depend on `visual_reference_package` data structures to populate character content
- **AND** cards MUST remain keyboard focusable so users can tab through characters and read metadata without using a pointing device.

### Requirement: Display Environment Keyframe Images
The Visual tab MUST present environment designs stored on the visual design document as focused reference cards.

#### Scenario: User views environment design card
- **GIVEN** a story has a `visualDesignDocument` with entries in `environment_designs`
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST show an "Environments" section containing one card per environment design
- **AND** each card MUST render the single reference image from `environment_reference_image_path`, normalizing the storage path as needed
- **AND** when no image path is present, the card MUST show a placeholder illustration and copy inviting the user to generate environment art
- **AND** metadata blocks MUST present the environment name (or ID), overall description, lighting and atmosphere, color tones, key elements, and associated scenelet IDs formatted as chips or a comma-separated list
- **AND** the implementation MUST NOT depend on `visual_reference_package` data structures to populate environment content
- **AND** cards MUST respond to keyboard focus with visible outlines to maintain accessibility.

### Requirement: Display Global Aesthetic
The Visual tab MUST display the global aesthetic information (visual style and master color palette) from the visual design document in a scannable, user-friendly format.

#### Scenario: User views global aesthetic section
- **GIVEN** a story has a visual design document with `global_aesthetic`
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST render the visual style name/description and master color palette swatches using the refreshed UI theme tokens (no raw JSON)
- **AND** each palette entry MUST list the color name and hex value with sufficient contrast against the new background colors
- **AND** the section MUST render ahead of the character and environment lists so users understand the overarching art direction before drilling into assets.

## ADDED Requirements
### Requirement: Visual Tab Handles Missing Data Gracefully
The Visual tab MUST provide reassuring empty states when the visual design document is unavailable or lacks specific sections.

#### Scenario: Visual tab shows empty state when document missing
- **GIVEN** `visualDesignDocument` is `null`, undefined, or does not contain any of the expected sections
- **WHEN** the user opens `/story/{storyId}/visual`
- **THEN** the page MUST display an empty state explaining that visual design data is not yet available and referencing the workflow needed to populate it
- **AND** no errors MUST surface in the console, and the layout MUST remain aligned with the rest of the Story Tree theme.
