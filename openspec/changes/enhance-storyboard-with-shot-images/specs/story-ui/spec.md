# story-ui Spec Delta

## MODIFIED Requirements

### Requirement: Render Scenelet Nodes with Content

The storyboard MUST display each scenelet as a card-style node showing the scenelet's description, shot images, and dialogue.

#### Scenario: Scenelet node displays shot image carousel

- **GIVEN** a scenelet exists with shot data including key frame image paths
- **WHEN** the scenelet node is rendered
- **THEN** the node MUST display a horizontal image carousel labeled "Shots"
- **AND** each shot MUST render as an image element with 16:9 aspect ratio
- **AND** each image MUST load from the key_frame_image_path stored in the shots table
- **AND** images MUST maintain aspect ratio without distortion (object-fit: cover)
- **AND** images MUST use lazy loading for offscreen shots (loading="lazy")
- **AND** if a key_frame_image_path is null or fails to load, a placeholder with "Image not available" MUST be shown
- **AND** the carousel MUST NOT display shot suggestion text descriptions

#### Scenario: Scenelet node shows carousel navigation controls

- **GIVEN** a scenelet has multiple shots in its carousel
- **WHEN** the carousel is rendered
- **THEN** left and right arrow buttons MUST appear overlaid on the carousel edges
- **AND** clicking the right arrow MUST scroll to show the next shot
- **AND** clicking the left arrow MUST scroll to show the previous shot
- **AND** the left arrow MUST be hidden when scrolled to the first shot
- **AND** the right arrow MUST be hidden when scrolled to the last shot
- **AND** the carousel MUST use CSS scroll-snap for smooth card snapping behavior

#### Scenario: Scenelet node adapts when no shot images exist

- **GIVEN** a scenelet has no shot data or all key_frame_image_paths are null
- **WHEN** the scenelet node is rendered
- **THEN** the node MUST NOT display the shots carousel
- **AND** the node MUST continue to display description and dialogue sections normally

---

## ADDED Requirements

### Requirement: Display Shot Detail Panel

The storyboard MUST provide an interactive shot detail panel that displays comprehensive shot metadata when a user clicks on a shot image.

#### Scenario: User clicks shot image to open detail panel

- **GIVEN** a scenelet node displays a shot carousel
- **WHEN** the user clicks on any shot image
- **THEN** a detail panel MUST slide in from the right side of the screen
- **AND** the panel MUST display a larger version of the key frame image at the top
- **AND** the panel MUST overlay the storyboard canvas with a semi-transparent backdrop
- **AND** the backdrop MUST dim the canvas content behind the panel
- **AND** the slide-in animation MUST complete within 300ms

#### Scenario: Shot detail panel displays shot metadata

- **GIVEN** the shot detail panel is open for a specific shot
- **WHEN** the panel is rendered
- **THEN** it MUST display the shot index (e.g., "Shot 1")
- **AND** it MUST display the created_at timestamp in human-readable format
- **AND** it MUST display the first_frame_prompt in a labeled section
- **AND** it MUST display the key_frame_prompt in a labeled section
- **AND** it MUST display the video_clip_prompt in a labeled section
- **AND** it MUST display the storyboard_payload as formatted JSON
- **AND** the JSON code block MUST wrap long lines to prevent horizontal scrolling
- **AND** the JSON MUST use proper indentation for readability

#### Scenario: User closes shot detail panel

- **GIVEN** the shot detail panel is open
- **WHEN** the user clicks the close button in the panel
- **THEN** the panel MUST slide out to the right
- **AND** the backdrop MUST fade out
- **AND** the slide-out animation MUST complete within 300ms
- **AND** the panel MUST be fully removed from the DOM after animation completes
- **AND WHEN** the user clicks on the backdrop
- **THEN** the panel MUST close with the same animation
- **AND WHEN** the user presses the Escape key
- **THEN** the panel MUST close with the same animation

#### Scenario: Shot detail panel handles missing image gracefully

- **GIVEN** a shot has a null key_frame_image_path or the image fails to load
- **WHEN** the shot detail panel is opened for that shot
- **THEN** the panel MUST display a placeholder image area with "Image not available" message
- **AND** the panel MUST still display all other shot metadata normally

---

### Requirement: Fetch Shot Data for Storyboard Visualization

The storyboard page MUST fetch shot data from the database alongside scenelet data to populate shot image carousels.

#### Scenario: Server-side data fetching includes shots

- **GIVEN** a story exists with scenelets and shots in the database
- **WHEN** the user navigates to `/story/{storyId}/storyboard`
- **THEN** the page MUST call a server-side function that fetches both scenelets and shots
- **AND** the function MUST query the shots table grouped by scenelet_id
- **AND** the function MUST return structured data containing scenelets with embedded shot arrays
- **AND** each shot MUST include: shotIndex, keyFrameImagePath, firstFrameImagePath, storyboardPayload, firstFramePrompt, keyFramePrompt, videoClipPrompt, createdAt

#### Scenario: Shot data is mapped to scenelet nodes

- **GIVEN** shot data is fetched for multiple scenelets
- **WHEN** the story tree data is assembled
- **THEN** each scenelet MUST include a `shots` array property
- **AND** shots MUST be ordered by shot_index in ascending order
- **AND** scenelets with no shots MUST have an empty `shots` array
- **AND** the existing `shotSuggestions` field MUST be retained for backward compatibility

#### Scenario: Image paths are transformed for public access

- **GIVEN** the database stores relative image paths starting with story ID (e.g., `{story-id}/shots/scenelet-1/shot-1_key_frame.png`)
- **WHEN** shot data is mapped to UI types
- **THEN** the image path fields MUST be transformed by prepending `/generated/`
- **AND** the resulting URL MUST be `/generated/{story-id}/shots/scenelet-1/shot-1_key_frame.png`
- **AND** this URL MUST resolve to files in `apps/story-tree-ui/public/generated/{story-id}/...`
- **AND** null image paths MUST remain null (not transformed)
- **AND** the transformation MUST occur in the data mapping layer, not in UI components

---

### Requirement: Maximize Storyboard Canvas Viewport

The storyboard page MUST remove unnecessary header elements to maximize canvas space for visualization.

#### Scenario: Storyboard page removes header container

- **GIVEN** the user navigates to the storyboard tab
- **WHEN** the page renders
- **THEN** the page MUST NOT display the "Storyboard Canvas" header text
- **AND** the page MUST NOT display the description text "Explore the narrative flow..."
- **AND** the canvas component MUST expand to use the full available viewport height
- **AND** the canvas height calculation MUST account for the sidebar and page padding only
