## MODIFIED Requirements
### Requirement: Render Story Explorer Shell
The Story Tree UI MUST present a left-aligned navigation shell that mirrors the storyboard aesthetic while anchoring story context in the sidebar.
#### Scenario: Sidebar shows story context and guided navigation
- **GIVEN** a user opens `/story/{storyId}/constitution` on a desktop viewport (≥1024px)
- **WHEN** the layout renders
- **THEN** the sidebar MUST remain visible on the left with a home icon button that links back to `/story`
- **AND** the story thumbnail MUST render at the top of the sidebar as a flat surface (no card wrapper) taking the available sidebar width while preserving its aspect ratio via max-width constraints
- **AND** the story title MUST appear directly beneath the thumbnail with the existing author line removed so only the title remains in the header stack
- **AND** navigation tabs MUST render as flat pills without card borders, list Constitution, Script, Storyboard, Visual, and Audio, and apply a subtle filled highlight plus `aria-current="page"` when selected
- **AND** tab icons MUST remain sourced from the shared icon library (e.g. Heroicons) sized consistently at 20–24px with hover states that rely on color, not elevation.

### Requirement: Display Story Catalog Cards
The story list MUST present each story with artwork and a synopsis so users can quickly scan available productions.
#### Scenario: Story list cards show thumbnail and logline
- **GIVEN** the story index page `/story` loads at least one story
- **WHEN** the grid renders
- **THEN** on desktop viewports (≥1024px) the grid MUST place two story cards per row with spacing that keeps each card noticeably wider than its height
- **AND** each story card MUST show the first available key frame image cropped to a square thumbnail on the left (falling back to a neutral illustration when no image paths exist)
- **AND** the story title MUST render to the right in a larger, bolder type treatment with no decorative color dot, author credit, or "Open Explorer" sub-action
- **AND** the second line MUST show the logline extracted from the constitution Markdown by reading the first bullet under the "Logline" heading (or gracefully falling back to muted helper copy when that section is missing) without surfacing error text
- **AND** the entire card MUST remain accessible as a single link to `/story/{storyId}/constitution` with focus styles that meet WCAG contrast requirements.

## ADDED Requirements
### Requirement: Use Subtle Card Elevation
The Story Tree UI MUST standardize card elevation so surfaces feel nearly flat with a gentle hover response instead of heavy drop shadows.

#### Scenario: Cards apply minimal elevation and hover highlight
- **GIVEN** a user views any Story Tree UI card component (story cards, visual asset cards, sidebar sections)
- **WHEN** the card renders at rest
- **THEN** it MUST use a low-opacity shadow or border that feels nearly flat against the background (e.g. 1–2px blur, 5–10% alpha) rather than the previous deep drop shadow
- **AND** when the user hovers or focuses the card, the elevation MUST increase only slightly in combination with a subtle background highlight to indicate interactivity without large offsets
- **AND** the hover state MUST avoid shifting layout by using box-shadow and background color changes instead of translating the card vertically.
