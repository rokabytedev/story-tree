# visual-ui Specification

## Purpose
TBD - created by archiving change extend-visual-tab-ui. Update Purpose after archive.
## Requirements
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

### Requirement: Preserve Visual Design and Reference JSON Display

The Visual tab MUST continue to display the raw JSON of both the visual design document and visual reference package for reference purposes.

#### Scenario: User views visual reference package JSON

- **GIVEN** a story has a visual reference package
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST display a section labeled "Visual Reference Package" with the raw JSON in a code block
- **AND** the JSON MUST be formatted with indentation for readability

#### Scenario: User views visual design document JSON

- **GIVEN** a story has a visual design document
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST display a section labeled "Visual Design Document" with the raw JSON in a code block
- **AND** the JSON MUST be formatted with indentation for readability

---

### Requirement: Handle Missing or Incomplete Visual Data

The Visual tab MUST gracefully handle cases where visual reference package or visual design document data is missing or incomplete.

#### Scenario: Visual reference package is missing

- **GIVEN** a story exists but has no visual reference package
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST display an empty state message for the characters and environments sections
- **AND** the message MUST indicate that visual reference images will populate once the workflow runs
- **AND** if the visual design document exists, it MUST still be displayed

#### Scenario: Visual design document is missing

- **GIVEN** a story exists but has no visual design document
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST display an empty state message
- **AND** the message MUST indicate that visual design outputs will populate once the workflow runs

#### Scenario: Character has no reference images

- **GIVEN** a character exists in the visual design document but has no reference plates in the visual reference package
- **WHEN** the user views the characters section
- **THEN** the page MUST still display the character ID heading
- **AND** the page MUST display a message "No reference images available for this character"
- **AND** the character design details from the visual design document MUST still be displayed

#### Scenario: Environment has no keyframes

- **GIVEN** an environment exists in the visual design document but has no keyframes in the visual reference package
- **WHEN** the user views the environments section
- **THEN** the page MUST still display the environment ID heading
- **AND** the page MUST display a message "No keyframes available for this environment"
- **AND** the environment design details from the visual design document MUST still be displayed

#### Scenario: Image file fails to load

- **GIVEN** an image card references an image path that cannot be loaded
- **WHEN** the image element attempts to load
- **THEN** the card MUST display a placeholder with the text "Image not available"
- **AND** the card MUST remain clickable to show the metadata in the detail panel

---

### Requirement: Integrate with Existing Story Data Fetching

The Visual tab MUST fetch visual reference package data using the existing `getStory` server-side data fetching function.

#### Scenario: Server fetches visual reference package

- **GIVEN** a story ID is provided
- **WHEN** the visual tab page loads
- **THEN** the server MUST call `getStory(storyId)` to fetch the story record
- **AND** the function MUST return the `visualReferencePackage` field as part of `StoryDetailViewModel`
- **AND** the `visualReferencePackage` field MUST be typed as `unknown | null` and parsed on the client side

#### Scenario: Visual tab receives story data with visual artifacts

- **GIVEN** the server successfully fetches a story with visual artifacts
- **WHEN** the visual tab page renders
- **THEN** the page MUST pass the `visualReferencePackage` and `visualDesignDocument` to the client-side visual reference view component
- **AND** the component MUST parse and validate the structure before rendering
- **AND** if parsing fails, the component MUST display an error state

---

### Requirement: Maintain Consistent UI Styling with Story UI Shell

The Visual tab MUST use the same theme tokens, spacing, and styling patterns as the existing story UI components.

#### Scenario: Visual tab respects application theme

- **GIVEN** the user has selected a theme (light or dark mode)
- **WHEN** the visual tab renders
- **THEN** all sections MUST use theme-appropriate background, border, and text colors
- **AND** image cards MUST use consistent border and shadow styles
- **AND** the detail panel MUST match the styling of the storyboard shot detail panel

#### Scenario: Visual tab uses generous but efficient spacing

- **GIVEN** the user views the visual tab
- **WHEN** the page renders
- **THEN** sections MUST have adequate vertical spacing (following design guidelines)
- **AND** image grids MUST have consistent gaps between cards
- **AND** text content MUST have proper line height and padding
- **AND** the layout MUST not waste excessive whitespace

---

### Requirement: Support Keyboard Accessibility for Detail Panel

The image detail panel MUST support keyboard navigation and accessible interaction patterns.

#### Scenario: User closes detail panel with keyboard

- **GIVEN** the image detail panel is open
- **WHEN** the user presses the ESC key
- **THEN** the panel MUST close
- **AND** focus MUST return to the image card that was clicked

#### Scenario: Detail panel is accessible to screen readers

- **GIVEN** a screen reader user opens the detail panel
- **WHEN** the panel renders
- **THEN** the panel MUST have a descriptive `aria-label` or accessible heading
- **AND** the close button MUST have an accessible label (e.g., "Close panel")
- **AND** all metadata fields MUST be properly labeled for screen readers

### Requirement: Visual Tab Handles Missing Data Gracefully
The Visual tab MUST provide reassuring empty states when the visual design document is unavailable or lacks specific sections.

#### Scenario: Visual tab shows empty state when document missing
- **GIVEN** `visualDesignDocument` is `null`, undefined, or does not contain any of the expected sections
- **WHEN** the user opens `/story/{storyId}/visual`
- **THEN** the page MUST display an empty state explaining that visual design data is not yet available and referencing the workflow needed to populate it
- **AND** no errors MUST surface in the console, and the layout MUST remain aligned with the rest of the Story Tree theme.

