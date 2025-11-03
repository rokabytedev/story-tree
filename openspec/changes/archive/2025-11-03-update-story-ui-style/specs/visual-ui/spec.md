## MODIFIED Requirements
### Requirement: Display Character Reference Images
The Visual tab MUST display character design data from the visual design document as curated profile cards.
#### Scenario: User views character design card
- **GIVEN** a story has a `visualDesignDocument` with at least one entry in `character_designs`
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST show a "Characters" section containing one card per character design
- **AND** each card MUST render the primary model sheet image across the full card width, constraining by width so the image aspect ratio is preserved without cropping
- **AND** the next line beneath the image MUST display the character identifier and a "Character" type label before listing metadata
- **AND** metadata MUST stack as flat text rows (role, attire, physique, facial features, etc.) without secondary card wrappers or columns
- **AND** a compact footer line MUST show associated scenelet IDs in a condensed, small-font string (e.g. comma-separated) aligned with the card width
- **AND** when the image path is missing, the card MUST display a placeholder illustration and helper text indicating the model sheet is not generated yet
- **AND** the implementation MUST NOT depend on `visual_reference_package` data structures to populate character content
- **AND** cards MUST remain keyboard focusable so users can tab through characters and read metadata without using a pointing device.

### Requirement: Display Environment Keyframe Images
The Visual tab MUST present environment designs stored on the visual design document as focused reference cards.
#### Scenario: User views environment design card
- **GIVEN** a story has a `visualDesignDocument` with entries in `environment_designs`
- **WHEN** the user navigates to `/story/{storyId}/visual`
- **THEN** the page MUST show an "Environments" section containing one card per environment design
- **AND** each card MUST render the reference image across the full card width, constraining by width so the aspect ratio is preserved without stretching
- **AND** the next line beneath the image MUST display the environment identifier together with an "Environment" type label
- **AND** metadata MUST present the environment name or ID, description, lighting and atmosphere, color tones, and key elements as individual flat text rows without nested metadata cards
- **AND** a compact footer line MUST list associated scenelet IDs in condensed formatting with muted, small typography
- **AND** when no image path is present, the card MUST show a placeholder illustration and copy inviting the user to generate environment art
- **AND** the implementation MUST NOT depend on `visual_reference_package` data structures to populate environment content
- **AND** cards MUST respond to keyboard focus with visible outlines to maintain accessibility.
