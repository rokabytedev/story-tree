# story-ui Specification

## Purpose
TBD - created by archiving change add-story-tree-ui-shell. Update Purpose after archive.
## Requirements
### Requirement: Provide Story Tree UI Workspace
The project MUST expose a standalone Story Tree UI workspace built with Next.js, React, TypeScript, and TailwindCSS.

#### Scenario: UI workspace builds independently
- **GIVEN** project dependencies are installed at the repository root
- **WHEN** a developer runs the UI workspace build script
- **THEN** the build MUST complete without depending on backend packages
- **AND** it MUST output a Next.js bundle that includes the shared theme tokens.

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

### Requirement: Support URL-Based Navigation
The Story Tree UI MUST rely on URL routes to reflect the active story and tab selection.

#### Scenario: Routes map to tab state
- **GIVEN** the user navigates to `/story/sample-story-id/visual`
- **WHEN** the page loads
- **THEN** the Visual tab MUST be selected in the sidebar
- **AND** switching to any other tab MUST update the URL to the corresponding path without a full page refresh.

### Requirement: Ensure Accessible Navigation Baseline
The Story Tree UI MUST satisfy baseline accessibility for navigation and content placeholders.

#### Scenario: Sidebar navigation supports keyboard and screen readers
- **GIVEN** the user focuses the sidebar using the keyboard
- **WHEN** they press arrow or tab keys to move between tabs
- **THEN** focus MUST move sequentially with visible outlines
- **AND** the active tab MUST expose an accessible name and `aria-current` state so screen readers announce the selection.

### Requirement: Display Interactive Story Tree Canvas

The Storyboard tab MUST render an interactive canvas visualization of the complete story tree structure, enabling users to explore scenelets, branching points, and narrative flow.

#### Scenario: User opens storyboard tab with existing story data

- **GIVEN** a story exists with at least one scenelet in the database
- **WHEN** the user navigates to `/story/{storyId}/storyboard`
- **THEN** the page MUST display an interactive canvas with the story tree visualization
- **AND** the canvas MUST show all scenelets as card-style nodes
- **AND** the canvas MUST show branching points as distinct choice nodes
- **AND** the canvas MUST render edges connecting parent and child nodes
- **AND** the initial view MUST auto-zoom to fit the entire tree within the viewport

#### Scenario: User navigates large story tree with zoom and pan

- **GIVEN** the storyboard canvas is displayed
- **WHEN** the user scrolls with a mouse wheel or uses pinch gesture on trackpad
- **THEN** the canvas MUST zoom in or out (range: 0.1x to 2x)
- **AND WHEN** the user clicks and drags on the canvas background
- **THEN** the canvas MUST pan to show different areas of the tree
- **AND** the zoom and pan state MUST be smooth and responsive (60 FPS target)

#### Scenario: Storyboard shows empty state when no story data exists

- **GIVEN** a story exists but has no scenelets
- **WHEN** the user navigates to `/story/{storyId}/storyboard`
- **THEN** the page MUST display an empty state message
- **AND** the message MUST indicate that the story has no content yet

---

### Requirement: Render Scenelet Nodes with Content

The storyboard MUST display each scenelet as a card-style node showing the scenelet's description, shots, and dialogue.

#### Scenario: Scenelet node displays core information

- **GIVEN** a scenelet exists with description, dialogue, and shot suggestions
- **WHEN** the scenelet is rendered as a node on the canvas
- **THEN** the node MUST display the scenelet ID (e.g., "Scenelet-1") as a heading
- **AND** the node MUST display the scenelet description in smaller, muted text
- **AND** the node MUST display the dialogue lines in character:line format
- **AND** each dialogue line MUST show the character name in emphasized text

#### Scenario: Scenelet node shows shot carousel

- **GIVEN** a scenelet has shot suggestions
- **WHEN** the scenelet node is rendered
- **THEN** the node MUST display a horizontal scrollable carousel
- **AND** the carousel MUST show one placeholder element per shot suggestion
- **AND** each placeholder MUST use a 16:9 aspect ratio (aspect-video)
- **AND** the carousel MUST allow horizontal scrolling if there are multiple shots

#### Scenario: Scenelet node adapts to content length

- **GIVEN** scenelets have varying amounts of dialogue (1 to 10 lines)
- **WHEN** scenelet nodes are rendered
- **THEN** each node MUST have a fixed width of 320px
- **AND** each node MUST expand vertically to accommodate all dialogue lines
- **AND** nodes with more content MUST be taller than nodes with less content

---

### Requirement: Render Branching Point Nodes

The storyboard MUST display branching points as distinct nodes showing the choice prompt and available choice labels.

#### Scenario: Branching point node shows choice information

- **GIVEN** a branching point exists with a choice prompt and two choice labels
- **WHEN** the branching point is rendered as a node
- **THEN** the node MUST use a distinct visual style (primary color accent, thicker border)
- **AND** the node MUST display the text "Choice" as a label
- **AND** the node MUST display the choice prompt question
- **AND** the node MUST list all available choice labels
- **AND** each choice label MUST be prefixed with an arrow symbol (→)

#### Scenario: Branching point connects to multiple child scenelets

- **GIVEN** a branching point leads to two child scenelets
- **WHEN** the canvas is rendered
- **THEN** the branching point node MUST have two outgoing edges
- **AND** each edge MUST connect to the corresponding child scenelet
- **AND** the edges MUST visually indicate the flow direction (top to bottom)

---

### Requirement: Calculate Tree Layout Automatically

The storyboard MUST compute node positions automatically using a tree layout algorithm to prevent overlapping and ensure readable structure.

#### Scenario: Tree layout positions nodes without overlap

- **GIVEN** a story tree with 20 scenelets across 5 levels of depth
- **WHEN** the canvas is rendered
- **THEN** no scenelet nodes MUST overlap with each other
- **AND** no branching point nodes MUST overlap with scenelet nodes
- **AND** child nodes MUST be positioned below their parent nodes
- **AND** sibling nodes MUST be positioned horizontally adjacent with adequate spacing

#### Scenario: Tree layout handles variable branching

- **GIVEN** a story tree where some scenelets have 1 child and others have 2 children
- **WHEN** the canvas is rendered
- **THEN** the layout MUST adapt to the varying number of children per node
- **AND** linear paths (single child) MUST be positioned in a straight vertical line
- **AND** branching paths (two children) MUST spread horizontally to accommodate both branches

---

### Requirement: Integrate with Existing UI Shell

The storyboard canvas MUST integrate seamlessly with the existing Story Tree UI workspace, respecting theme, layout, and navigation patterns.

#### Scenario: Storyboard respects application theme

- **GIVEN** the user has selected a theme (light or dark mode)
- **WHEN** the storyboard canvas is displayed
- **THEN** scenelet nodes MUST use theme-appropriate background, border, and text colors
- **AND** branching point nodes MUST use theme-appropriate primary color accents
- **AND** the canvas background MUST use the theme's background color

#### Scenario: Storyboard fits within workspace layout

- **GIVEN** the user is viewing the storyboard tab
- **WHEN** the page renders
- **THEN** the canvas MUST occupy the available width and height within the main content area
- **AND** the canvas MUST not obscure the left sidebar navigation
- **AND** the canvas height MUST account for the page header and padding

---

### Requirement: Fetch Story Tree Data from Backend

The storyboard page MUST fetch story tree data from the backend API to populate the canvas visualization.

#### Scenario: Server-side data fetching for storyboard

- **GIVEN** a story exists with scenelets in the database
- **WHEN** the user navigates to `/story/{storyId}/storyboard`
- **THEN** the page MUST call a server-side function to fetch the story tree data
- **AND** the function MUST return structured data containing scenelets and branching points
- **AND** the function MUST handle errors gracefully (e.g., database unavailable)
- **AND** if data fetching fails, the page MUST display an error message

#### Scenario: Story tree data includes all necessary fields

- **GIVEN** scenelets are stored in the database
- **WHEN** the story tree data is fetched
- **THEN** each scenelet MUST include: id, parentId, description, dialogue, shotSuggestions, choiceLabel
- **AND** each branching point MUST include: id, sourceSceneletId, choicePrompt, choices
- **AND** the data MUST be returned in a format compatible with the canvas component

---

### Requirement: Support Performance for Medium-Sized Trees

The storyboard canvas MUST render and interact smoothly for story trees with up to 100 nodes.

#### Scenario: Canvas renders 100-node tree within acceptable time

- **GIVEN** a story tree with 100 scenelets
- **WHEN** the user navigates to the storyboard tab
- **THEN** the canvas MUST complete initial render within 2 seconds
- **AND** the tree layout calculation MUST complete within 500ms
- **AND** subsequent zoom/pan interactions MUST maintain 60 FPS (or close approximation)

#### Scenario: Canvas handles large trees gracefully

- **GIVEN** a story tree with 50+ nodes
- **WHEN** the user zooms, pans, or drags the canvas
- **THEN** the canvas MUST remain responsive without lag or stuttering
- **AND** browser memory usage MUST not exceed reasonable limits (< 200 MB for canvas component)

### Requirement: Apply Storybook Theme Palette
The Story Tree UI MUST apply the provided pastel palette through shared theme tokens so components inherit a consistent "storybook" look and future palette swaps remain low effort.

#### Scenario: Story Tree UI loads pastel palette tokens
- **GIVEN** the Story Tree workspace loads global styles
- **WHEN** the page renders
- **THEN** the CSS variables `--color-page`, `--color-surface`, `--color-surface-muted`, `--color-border`, `--color-highlight`, `--color-text-primary`, and `--color-text-muted` MUST resolve to the palette values `#fefae0`, `#faedcd`, `#e9edc9`, `#dfb98e`, `#d4a373`, `#755a3f`, and `#947251` respectively
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
- **THEN** on desktop viewports (≥1024px) the grid MUST place two story cards per row with spacing that keeps each card noticeably wider than its height
- **AND** each story card MUST show the first available key frame image cropped to a square thumbnail on the left (falling back to a neutral illustration when no image paths exist)
- **AND** the story title MUST render to the right in a larger, bolder type treatment with no decorative color dot, author credit, or "Open Explorer" sub-action
- **AND** the second line MUST show the logline extracted from the constitution Markdown by reading the first bullet under the "Logline" heading (or gracefully falling back to muted helper copy when that section is missing) without surfacing error text
- **AND** the entire card MUST remain accessible as a single link to `/story/{storyId}/constitution` with focus styles that meet WCAG contrast requirements.

### Requirement: Use Subtle Card Elevation
The Story Tree UI MUST standardize card elevation so surfaces feel nearly flat with a gentle hover response instead of heavy drop shadows.

#### Scenario: Cards apply minimal elevation and hover highlight
- **GIVEN** a user views any Story Tree UI card component (story cards, visual asset cards, sidebar sections)
- **WHEN** the card renders at rest
- **THEN** it MUST use a low-opacity shadow or border that feels nearly flat against the background (e.g. 1–2px blur, 5–10% alpha) rather than the previous deep drop shadow
- **AND** when the user hovers or focuses the card, the elevation MUST increase only slightly in combination with a subtle background highlight to indicate interactivity without large offsets
- **AND** the hover state MUST avoid shifting layout by using box-shadow and background color changes instead of translating the card vertically.

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

