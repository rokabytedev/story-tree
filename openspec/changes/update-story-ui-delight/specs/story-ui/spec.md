## ADDED Requirements
### Requirement: Apply Storybook Theme Palette
The Story Tree UI MUST apply the provided pastel palette through shared theme tokens so components inherit a consistent "storybook" look and future palette swaps remain low effort.

#### Scenario: Story Tree UI loads pastel palette tokens
- **GIVEN** the Story Tree workspace loads global styles
- **WHEN** the page renders
- **THEN** the CSS variables `--color-page`, `--color-surface`, `--color-surface-muted`, `--color-border`, `--color-highlight`, `--color-text-primary`, and `--color-text-muted` MUST resolve to the palette values `#f0ead2`, `#dde5b6`, `#adc178`, `#a98467`, `#6c584c`, `#3b341f`, and `#6f6042` respectively
- **AND** Tailwind tokens MUST read from those variables so no component uses the retired dark hex codes directly (e.g. no remaining `#0b1120` assignments)
- **AND** a shared theme module MUST export the palette map so components that need inline styles (e.g. gradients) can consume the same colors without duplicating literals.

### Requirement: Render Constitution Markdown
The Constitution tab MUST render Markdown content with full semantic formatting instead of reducing it to plain paragraphs.

#### Scenario: Constitution tab renders semantic Markdown
- **GIVEN** a story constitution includes headings, emphasis, bullet lists, and hyperlinks in its Markdown
- **WHEN** a user views `/story/{storyId}/constitution`
- **THEN** headings MUST render with the correct HTML semantics up to level 3 using typography that reflects hierarchy
- **AND** lists MUST render with list markers and indentation
- **AND** emphasized text (`*italic*`, `**bold**`) MUST render with appropriate styling
- **AND** hyperlinks MUST display with accent coloration, underline on hover, and open in a new tab with `rel="noopener"`
- **AND** blockquotes or code blocks (when present) MUST render with theme-aligned background treatments rather than raw text.

### Requirement: Display Story Catalog Cards
The story list MUST present each story with artwork and a synopsis so users can quickly scan available productions.

#### Scenario: Story list cards show thumbnail and logline
- **GIVEN** the story index page `/story` loads at least one story
- **WHEN** the grid renders
- **THEN** each story card MUST show the first available key frame image cropped to a square thumbnail on the left (falling back to a neutral illustration when no image paths exist)
- **AND** the story title MUST render to the right in a larger, bolder type treatment without trailing accent dots
- **AND** the second line MUST show the logline extracted from the constitution Markdown in a smaller, muted font
- **AND** the entire card MUST remain accessible as a single link to `/story/{storyId}/constitution` with focus styles that meet WCAG contrast requirements.

-### Requirement: Present Audio Design Overview
The Audio tab MUST foreground core audio design insights in a structured layout while retaining the full JSON artifact for reference.

#### Scenario: Audio tab surfaces structured metadata and cue playback
- **GIVEN** a story has an `audioDesignDocument` containing `sonic_identity`, `narrator_voice_profile`, `character_voice_profiles`, and `music_and_ambience_cues`
- **WHEN** a user views `/story/{storyId}/audio`
- **THEN** the page MUST display the sonic identity section first, including tone, pacing, and instrumentation notes in styled callouts
- **AND** the page MUST list the narrator and character voice profiles with readable labels for character identifiers, voice names, and performance notes without exposing raw JSON fields directly
- **AND** the page MUST show a cue playlist that renders each cue name with associated context and includes embedded play/pause controls that source audio from the generated music directory
- **AND** starting playback for one cue MUST stop any other cue that is currently playing and reset its progress indicator
- **AND** a collapsible or clearly separated block MUST still render the raw audio design JSON below the structured sections for power users.

## MODIFIED Requirements
### Requirement: Render Story Artifact Tabs
The Story Tree UI MUST render story artifacts with representations tailored to each content type instead of generic placeholders.

#### Scenario: Tabs show artifact-specific experiences
- **GIVEN** constitution, script, storyboard, visual design, and audio design data are available for a story
- **WHEN** the user switches between tabs in the story detail view
- **THEN** the Constitution tab MUST render rich Markdown using the Markdown preview component
- **AND** the Script tab MUST render the interactive script YAML in the existing code block presentation
- **AND** the Visual tab MUST render the design cards described in the Visual UI specification
- **AND** the Audio tab MUST present the structured audio design overview before the raw JSON reference block
- **AND** the Storyboard tab MUST display the interactive canvas view (or its empty state when the story lacks scenelets).

### Requirement: Render Story Explorer Shell
The Story Tree UI MUST present a left-aligned navigation shell that mirrors the storyboard aesthetic while anchoring story context in the sidebar.

#### Scenario: Sidebar shows story context and guided navigation
- **GIVEN** a user opens `/story/{storyId}/constitution` on a desktop viewport (≥1024px)
- **WHEN** the layout renders
- **THEN** the sidebar MUST remain visible on the left with a home icon button that links back to `/story`
- **AND** the story thumbnail (derived from the story thumbnail image path) MUST appear to the left of the story title inside the sidebar header, with a placeholder illustration when the thumbnail is missing
- **AND** the story title and author text MUST render beside the thumbnail inside the sidebar header (not in the main canvas)
- **AND** navigation tabs MUST list Constitution, Script, Storyboard, Visual, and Audio with icons sourced from a shared icon library (e.g. Heroicons) sized consistently at 20–24px
- **AND** each tab entry MUST include the updated descriptive copy: "Story blueprint & principles", "Branching script overview", "Explore branching flow", "Character & world art", and "Music & sound plan".

#### Scenario: Sidebar remains fixed while canvas scrolls
- **GIVEN** a user scrolls the story detail page on desktop
- **WHEN** the main content exceeds viewport height
- **THEN** the sidebar MUST stay fixed in place without scrolling with the content while the main canvas scrolls independently
- **AND** the sidebar width MUST remain constant so the navigation does not shift position during scroll.

#### Scenario: Main canvas focuses on tab content
- **GIVEN** a story detail page renders any artifact tab
- **WHEN** the main content loads
- **THEN** the main panel MUST fill the remaining viewport width/height, omit the legacy accent dot, and exclude duplicate story titles or metadata already shown in the sidebar
- **AND** the panel MUST reserve its header area (if any) for tab-specific controls or breadcrumbs rather than story chrome.
