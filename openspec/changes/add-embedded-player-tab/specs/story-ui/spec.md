## MODIFIED Requirements
### Requirement: Render Story Explorer Shell
The Story Tree UI MUST present a left-aligned navigation shell that mirrors the storyboard aesthetic while anchoring story context in the sidebar.
#### Scenario: Sidebar shows story context and guided navigation
- **GIVEN** a user opens `/story/{storyId}/constitution` on a desktop viewport (≥1024px)
- **WHEN** the layout renders
- **THEN** the sidebar MUST remain visible on the left with a home icon button that links back to `/story`
- **AND** the story thumbnail (derived from the story thumbnail image path) MUST appear to the left of the story title inside the sidebar header, with a placeholder illustration when the thumbnail is missing
- **AND** the story title and author text MUST render beside the thumbnail inside the sidebar header (not in the main canvas)
- **AND** navigation tabs MUST list Constitution, Script, Storyboard, Visual, Audio, and Player with icons sourced from a shared icon library (e.g. Heroicons) sized consistently at 20–24px
- **AND** each tab entry MUST include the descriptive copy: "Story blueprint & principles", "Branching script overview", "Explore branching flow", "Character & world art", "Music & sound plan", and "Interactive playback preview"

### Requirement: Render Story Artifact Tabs
The Story Tree UI MUST render story artifacts with representations tailored to each content type instead of generic placeholders.
#### Scenario: Tabs show artifact-specific experiences
- **GIVEN** constitution, script, storyboard, visual design, audio design, and a generated player bundle are available for a story
- **WHEN** the user switches between tabs in the story detail view
- **THEN** the Constitution tab MUST render rich Markdown using the Markdown preview component
- **AND** the Script tab MUST render the interactive script YAML in the existing code block presentation
- **AND** the Visual tab MUST render the design cards described in the Visual UI specification
- **AND** the Audio tab MUST present the structured audio design overview before the raw JSON reference block
- **AND** the Storyboard tab MUST display the interactive canvas view (or its empty state when the story lacks scenelets)
- **AND** the Player tab MUST render the embedded player experience defined in the story-player specification, using generated assets without copying them into a separate bundle

## ADDED Requirements
### Requirement: Render Story Playback Tab
The Story Tree UI MUST provide a dedicated playback tab so editors can experience the branching story inside the workspace.
#### Scenario: Player tab fills the main canvas
- **GIVEN** a story has playable shots and the user navigates to `/story/{storyId}/player`
- **WHEN** the page renders on desktop or tablet
- **THEN** the main panel MUST dedicate the entire scrollable area to the playback experience without wrapping it inside an additional card or inset container
- **AND** the player canvas MUST stretch to the maximum available width while preserving image aspect ratio (no cropping or distortion)
- **AND** the controls (start, play/pause, branch choices) MUST appear flush with the canvas edges using the Story Tree spacing tokens so the layout matches the rest of the app

#### Scenario: Embedded player loads bundle data via server accessor
- **GIVEN** the player tab is rendered on the server
- **WHEN** data is fetched for `/story/{storyId}/player`
- **THEN** the loader MUST call the shared story-player bundle accessor to retrieve metadata, scenelets, and asset URLs rooted at `/generated/{storyId}/`
- **AND** the loader MUST surface errors with the existing inline alert pattern used in other tabs when bundle assembly fails
- **AND** the embedded React components MUST hand the retrieved bundle to the shared runtime so playback timing, branching, and grace periods match the standalone player
