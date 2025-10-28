# Spec Delta: story-ui

## ADDED Requirements

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
