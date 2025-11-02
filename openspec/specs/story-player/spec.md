# story-player Specification

## Purpose
TBD - created by archiving change add-standalone-player. Update Purpose after archive.
## Requirements
### Requirement: Load Story Bundle Data

The player MUST load story metadata and structure from a JSON file to drive playback.

#### Scenario: Player loads external JSON via URL parameter
- **GIVEN** the player HTML is opened with `?story=story.json` URL parameter
- **WHEN** the page loads
- **THEN** it MUST fetch and parse the JSON file from the relative path
- **AND** it MUST validate the JSON structure (metadata, rootSceneletId, scenelets array)
- **AND** it MUST throw an error if the JSON is invalid or missing required fields

#### Scenario: Player displays error for missing JSON
- **GIVEN** the player HTML is opened without a story parameter
- **WHEN** the page loads
- **THEN** it MUST display a user-friendly error message
- **AND** the message MUST indicate that a story file is required

#### Scenario: Player validates scenelet references
- **GIVEN** the story JSON is loaded
- **WHEN** the player initializes
- **THEN** it MUST verify that rootSceneletId references an existing scenelet
- **AND** it MUST verify that all next.sceneletId references point to existing scenelets
- **AND** it MUST verify that all choice.sceneletId references point to existing scenelets
- **AND** it MUST throw a descriptive error if any reference is invalid

---

### Requirement: Display Start Screen

The player MUST show a start screen with a start button before beginning playback.

#### Scenario: Start screen displays story title
- **GIVEN** the story JSON is successfully loaded
- **WHEN** the player initializes
- **THEN** it MUST display the story title from metadata.title
- **AND** it MUST show a prominent "Start Story" button
- **AND** it MUST not auto-play any content

#### Scenario: Start button begins playback
- **GIVEN** the start screen is displayed
- **WHEN** the user clicks the "Start Story" button
- **THEN** the player MUST transition to the first shot of the root scenelet
- **AND** the start button MUST be hidden

---

### Requirement: Play Shots Sequentially with Auto-Play Timing

The player MUST display each shot's image and play its audio with configurable grace periods, where audio duration controls the playback pace.

#### Scenario: Shot displays image with ramp-up grace period
- **GIVEN** a shot begins playback
- **WHEN** the shot image loads
- **THEN** the player MUST display the image
- **AND** it MUST wait 500ms (configurable) "ramp-up grace period" before starting audio
- **AND** the image MUST maintain its original aspect ratio without stretching
- **AND** the grace period prevents viewers from being surprised by immediate audio

#### Scenario: Shot auto-plays audio after grace period
- **GIVEN** the ramp-up grace period (500ms) has elapsed
- **WHEN** the audio file path is not null
- **THEN** the player MUST load and play the audio file automatically
- **AND** it MUST wait for the audio to finish playing
- **AND** the audio duration MUST control the pace of playback

#### Scenario: Shot advances after ramp-down grace period
- **GIVEN** the shot audio has finished playing (or no audio exists)
- **WHEN** the ramp-down grace period (500ms, configurable) elapses
- **THEN** the player MUST advance to the next state based on scenelet.next.type
- **AND** the ramp-down grace period MUST provide a smooth transition between shots

#### Scenario: Shot handles missing image file
- **GIVEN** a shot's imagePath file does not exist
- **WHEN** the player attempts to load the image
- **THEN** it MUST display a placeholder or error message
- **AND** it MUST continue playback instead of halting

#### Scenario: Shot handles missing audio file
- **GIVEN** a shot's audioPath is null or the file does not exist
- **WHEN** the shot playback reaches the audio phase
- **THEN** it MUST skip audio playback and proceed after ramp-down grace period
- **AND** it MUST not throw an error or halt playback

---

### Requirement: Auto-Play Linear Continuation

The player MUST automatically advance to the next scenelet when the current scenelet's next.type is "linear".

#### Scenario: Linear continuation advances automatically
- **GIVEN** the current scenelet's last shot has finished playing
- **WHEN** scenelet.next.type is "linear"
- **THEN** the player MUST load the scenelet referenced by next.sceneletId
- **AND** it MUST begin playing the first shot of the new scenelet
- **AND** it MUST not require user interaction

---

### Requirement: Display Choice UI for Branching Points

The player MUST pause playback and display a choice selection interface when scenelet.next.type is "branch".

#### Scenario: Branch displays choice prompt and options
- **GIVEN** the current scenelet's last shot has finished
- **WHEN** scenelet.next.type is "branch"
- **THEN** the player MUST pause on the last shot image
- **AND** it MUST display the next.choicePrompt text at the top center of the overlay
- **AND** it MUST display all choices from next.choices array

#### Scenario: Choice options show thumbnails and labels
- **GIVEN** the branch choice UI is displayed
- **WHEN** rendering each choice option
- **THEN** it MUST display the first shot image of the target scenelet as a thumbnail
- **AND** it MUST display the choice.label text below the thumbnail
- **AND** the thumbnail MUST be clickable

#### Scenario: Choice selection advances to selected branch
- **GIVEN** the branch choice UI is displayed with multiple options
- **WHEN** the user clicks a choice option
- **THEN** the player MUST load the scenelet referenced by the selected choice.sceneletId
- **AND** it MUST begin playing the first shot of the selected scenelet
- **AND** it MUST hide the choice overlay

#### Scenario: Two-choice layout displays side-by-side
- **GIVEN** a branch has exactly 2 choices
- **WHEN** the choice UI renders
- **THEN** it MUST display choices in a horizontal layout (left and right)
- **AND** each choice MUST show thumbnail above and label below
- **AND** thumbnails MUST be adequately sized for visibility

---

### Requirement: Display Restart UI for Terminal Nodes

The player MUST show a restart button when reaching a terminal scenelet.

#### Scenario: Terminal node shows restart button
- **GIVEN** the current scenelet's last shot has finished
- **WHEN** scenelet.next.type is "terminal"
- **THEN** the player MUST pause on the last shot image
- **AND** it MUST display a "Start Over" button with an appropriate icon
- **AND** it MUST not auto-advance or loop

#### Scenario: Restart button resets playback to start screen
- **GIVEN** the terminal restart UI is displayed
- **WHEN** the user clicks the "Start Over" button
- **THEN** the player MUST return to the initial start screen state
- **AND** it MUST display the original "Start Story" button
- **AND** clicking "Start Story" again MUST begin from the root scenelet

---

### Requirement: Handle Incomplete Story Endings

The player MUST handle incomplete work-in-progress stories by stopping without showing restart UI when reaching a non-terminal ending.

#### Scenario: Incomplete ending stops without restart button
- **GIVEN** the current scenelet's last shot has finished
- **WHEN** scenelet.next.type is "incomplete"
- **THEN** the player MUST pause on the last shot image
- **AND** it MUST not display a "Start Over" button
- **AND** it MUST remain paused at the final shot
- **AND** the user can manually reload the page to replay

#### Scenario: Player distinguishes terminal from incomplete
- **GIVEN** the story bundle contains both terminal and incomplete scenelets
- **WHEN** the player reaches a terminal scenelet
- **THEN** it MUST show the restart button
- **AND WHEN** the player reaches an incomplete scenelet
- **THEN** it MUST not show the restart button
- **AND** the UI MUST clearly indicate different end states

---

### Requirement: Provide Playback Controls

The player MUST provide play/pause controls to allow users to pause and resume playback.

#### Scenario: Play/pause button toggles audio playback
- **GIVEN** a shot is currently playing audio
- **WHEN** the user clicks the pause button
- **THEN** the audio MUST pause at its current position
- **AND** the button icon MUST change to a play icon

#### Scenario: Play button resumes audio playback
- **GIVEN** playback is paused during a shot's audio
- **WHEN** the user clicks the play button
- **THEN** the audio MUST resume from its paused position
- **AND** the button icon MUST change back to a pause icon

#### Scenario: Pause button prevents auto-advance
- **GIVEN** playback is paused
- **WHEN** the current shot's audio finishes or grace period elapses
- **THEN** the player MUST not auto-advance to the next shot or state
- **AND** it MUST wait for the user to click play

---

### Requirement: Maintain Responsive Layout

The player MUST adapt to different screen sizes while preserving image quality and usability.

#### Scenario: Image container maximizes available space
- **GIVEN** the player is displayed on various screen sizes
- **WHEN** the page renders
- **THEN** the image container MUST occupy the maximum available area
- **AND** it MUST maintain the image's original aspect ratio without stretching or cropping

#### Scenario: Controls remain accessible at bottom
- **GIVEN** the player layout is rendered
- **WHEN** displaying controls
- **THEN** the play/pause controls MUST be positioned at the bottom of the player box
- **AND** controls MUST not overlap the shot image
- **AND** controls MUST remain visible and clickable

#### Scenario: Choice UI adapts to narrow screens
- **GIVEN** the player is displayed on a narrow screen (mobile)
- **WHEN** the branch choice UI renders
- **THEN** choice options MUST remain readable and clickable
- **AND** thumbnails MUST be appropriately scaled for the screen size

---

### Requirement: Apply Minimalist Professional Design

The player UI MUST use a clean, professional design that appeals to both children and adults.

#### Scenario: Player box uses minimalist styling
- **GIVEN** the player renders
- **WHEN** displaying the player container
- **THEN** it MUST use a simple border and neutral background colors
- **AND** it MUST avoid childish or overly decorative elements
- **AND** it MUST use readable, standard fonts

#### Scenario: Visual hierarchy emphasizes content
- **GIVEN** the player is displaying a shot
- **WHEN** the user views the page
- **THEN** the shot image MUST be the primary visual focus
- **AND** controls and UI elements MUST use subtle styling to avoid distraction
- **AND** text overlays (choice prompts, buttons) MUST be legible against the background

---

### Requirement: Support Offline Playback

The player MUST function entirely offline without network requests after initial page load.

#### Scenario: Player works without internet connection
- **GIVEN** the player folder is loaded locally (file:// protocol or local server)
- **WHEN** the user opens player.html
- **THEN** it MUST load story.json from the relative path
- **AND** it MUST load all image and audio assets from relative paths
- **AND** it MUST not make any external network requests

#### Scenario: Player uses relative asset paths
- **GIVEN** story.json contains asset paths like "assets/shots/intro/0_key_frame.png"
- **WHEN** the player loads an asset
- **THEN** it MUST resolve the path relative to the player.html location
- **AND** it MUST successfully load assets from the local folder structure

### Requirement: Bundle Background Music Assets
The player bundle MUST package background music cue files so the standalone player can load them.

#### Scenario: Copy cue audio into bundle
- **GIVEN** the bundle task is assembling assets for a story
- **WHEN** a cue in `audioDesignDocument.music_and_ambience_cues` references `cue_name` "Moonlight"
- **THEN** the file `public/generated/<story-id>/music/Moonlight.m4a` MUST be copied into the bundle output
- **AND** the player JSON MUST map the cue to its associated scenelet IDs.

#### Scenario: Missing cue file logs warning
- **GIVEN** a cue is listed in `music_and_ambience_cues`
- **WHEN** the corresponding `.m4a` file is absent
- **THEN** the bundle task MUST log a warning identifying the missing cue
- **AND** it MUST continue generating the bundle without throwing an error.

### Requirement: Background Music Playback
The standalone player MUST play bundled music cues with smooth transitions aligned to scenelet progression.

#### Scenario: Start cue when entering first associated scenelet
- **GIVEN** playback enters a scenelet listed under cue "Moonlight"
- **WHEN** the previous cue differs or no cue was active
- **THEN** the player MUST start playing `music/Moonlight.m4a`
- **AND** it MUST use a configurable volume constant for music playback.

#### Scenario: Continue cue across consecutive scenelets
- **GIVEN** playback remains within scenelets associated to the currently playing cue
- **WHEN** advancing to the next scenelet in that cue's list
- **THEN** the player MUST keep the cue playing without restarting from the beginning.

#### Scenario: Cross-fade between cues
- **GIVEN** playback moves from a scenelet using cue "Moonlight" to one using cue "Sunrise"
- **WHEN** the transition occurs
- **THEN** the player MUST cross-fade between the two tracks using a configurable duration (default 0.5s)
- **AND** both audio elements MUST respect the configured volume constant.

#### Scenario: Warn for non-consecutive cue mapping
- **GIVEN** a cue is mapped to non-consecutive scenelet IDs
- **WHEN** playback reaches a gap in the cue's coverage
- **THEN** the player MUST log a warning indicating the cue spans non-consecutive scenelets
- **AND** it MUST fall back to stopping the cue at the gap without crashing.

#### Scenario: Skip music when cue unavailable
- **GIVEN** playback enters a scenelet without a mapped cue or with a missing file
- **WHEN** the player determines no cue is available
- **THEN** it MUST play no background music
- **AND** it MUST continue shot playback normally.

