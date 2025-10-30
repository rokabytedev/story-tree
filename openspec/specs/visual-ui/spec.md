# visual-ui Specification

## Purpose
TBD - created by archiving change extend-visual-tab-ui. Update Purpose after archive.
## Requirements
### Requirement: Display Character Reference Images

The Visual tab MUST display character reference images from the visual reference package in a browsable grid layout with detailed metadata access.

#### Scenario: User views character reference images

- **GIVEN** a story has a visual reference package with character model sheets
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST display a "Characters" section
- **AND** for each character in `character_model_sheets`, the page MUST display a subsection with the character ID as the heading
- **AND** each character subsection MUST display a grid of image cards for all reference plates
- **AND** each image card MUST show the image (or placeholder if `image_path` is missing) and the `plate_description` text below it
- **AND** the image card MUST be clickable to open a detail panel

#### Scenario: User clicks character reference image to view details

- **GIVEN** a character reference image card is displayed
- **WHEN** the user clicks on the image card
- **THEN** a right-side detail panel MUST open (similar to storyboard shot detail panel)
- **AND** the panel MUST display the full image at the top
- **AND** the panel MUST display the image type (e.g., "CHARACTER_MODEL_SHEET")
- **AND** the panel MUST display the `plate_description` text
- **AND** the panel MUST display the full `image_generation_prompt` with proper formatting (rendering `\n` as line breaks)
- **AND** the user MUST be able to close the panel by clicking a close button, clicking outside, or pressing the ESC key

#### Scenario: User views character design details from visual design document

- **GIVEN** a story has both a visual design document and visual reference package
- **WHEN** the user views a character's reference images
- **THEN** below the image grid, the page MUST display the character's design details from the visual design document
- **AND** the design details MUST include all fields from the `detailed_description` object (e.g., `attire`, `physique`, `facial_features`)
- **AND** each field MUST be labeled and formatted for readability (not raw JSON)
- **AND** newline characters (`\n`) in the text MUST be rendered as actual line breaks

---

### Requirement: Display Environment Keyframe Images

The Visual tab MUST display environment keyframe images from the visual reference package in a browsable grid layout with detailed metadata access.

#### Scenario: User views environment keyframe images

- **GIVEN** a story has a visual reference package with environment keyframes
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST display an "Environments" section
- **AND** for each environment in `environment_keyframes`, the page MUST display a subsection with the environment ID as the heading
- **AND** each environment subsection MUST display a grid of image cards for all keyframes
- **AND** each image card MUST show the image (or placeholder if `image_path` is missing) and the `keyframe_description` text below it
- **AND** the image card MUST be clickable to open a detail panel

#### Scenario: User clicks environment keyframe image to view details

- **GIVEN** an environment keyframe image card is displayed
- **WHEN** the user clicks on the image card
- **THEN** a right-side detail panel MUST open
- **AND** the panel MUST display the full image at the top
- **AND** the panel MUST display the `keyframe_description` text
- **AND** the panel MUST display the full `image_generation_prompt` with proper formatting (rendering `\n` as line breaks)
- **AND** the user MUST be able to close the panel by clicking a close button, clicking outside, or pressing the ESC key

#### Scenario: User views environment design details from visual design document

- **GIVEN** a story has both a visual design document and visual reference package
- **WHEN** the user views an environment's keyframe images
- **THEN** below the image grid, the page MUST display the environment's design details from the visual design document
- **AND** the design details MUST include all fields from the `detailed_description` object (e.g., `overall_description`, `lighting_and_atmosphere`, `color_tones`, `key_elements`)
- **AND** each field MUST be labeled and formatted for readability (not raw JSON)
- **AND** newline characters (`\n`) in the text MUST be rendered as actual line breaks

---

### Requirement: Display Global Aesthetic

The Visual tab MUST display the global aesthetic information (visual style and master color palette) from the visual design document in a scannable, user-friendly format.

#### Scenario: User views global aesthetic section

- **GIVEN** a story has a visual design document with `global_aesthetic`
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST display a "Global Aesthetic" section
- **AND** the section MUST display the visual style name prominently
- **AND** the section MUST display the visual style description with proper formatting
- **AND** newline characters (`\n`) in the description MUST be rendered as actual line breaks

#### Scenario: User views master color palette

- **GIVEN** a story has a visual design document with a `master_color_palette`
- **WHEN** the user views the global aesthetic section
- **THEN** the section MUST display the master color palette in a grid layout
- **AND** each color entry MUST display a color swatch filled with the `hex_code` color
- **AND** each color entry MUST display the `color_name` text
- **AND** each color entry MUST display the `hex_code` text
- **AND** each color entry MUST display the `usage_notes` text
- **AND** the layout MUST be concise and scannable (grid with adequate spacing)

---

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

