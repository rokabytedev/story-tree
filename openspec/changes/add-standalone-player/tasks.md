# Implementation Tasks

## Milestone 1: Backend Bundle Infrastructure

### 1.1 Bundle Module Scaffolding
- [x] Create `agent-backend/src/bundle/` directory
- [x] Create `agent-backend/src/bundle/types.ts` with TypeScript interfaces:
  - `StoryBundle`, `StoryMetadata`, `SceneletNode`, `ShotNode`, `NextNode` types
  - `BundleAssemblerOptions`, `AssetCopierOptions`, `PlayerBundleTaskOptions` types
- [x] Create `agent-backend/src/bundle/__tests__/` directory for unit tests

### 1.2 Bundle Assembler Implementation
- [x] Create `agent-backend/src/bundle/bundleAssembler.ts`
- [x] Implement `assembleBundleJson(storyId, dependencies)` function
  - Fetch story record with display_name
  - Fetch all scenelets for story
  - Fetch all shots grouped by scenelet
  - Filter scenelets to only include those with at least one shot having assets (keyFrameImagePath OR audioFilePath)
  - Build metadata section (storyId, title, exportedAt)
  - Identify root scenelet (parentId === null)
  - Transform scenelets to SceneletNode array with shots and next logic
- [x] Implement `determineNextState(scenelet, childScenelets, availableSceneletIds)` helper
  - Return `{ type: 'terminal' }` if isTerminalNode === true
  - Return `{ type: 'incomplete' }` if no children have available assets
  - Filter children to only those with available assets
  - Return `{ type: 'branch', choicePrompt, choices }` if isBranchPoint === true AND 2+ children available
  - Return `{ type: 'linear', sceneletId }` if only 1 child available (even if originally a branch)
  - Return `{ type: 'incomplete' }` if linear expected but no child available
- [x] Write unit tests for bundleAssembler with complete and incomplete story scenarios

### 1.3 Asset Copier Implementation
- [x] Create `agent-backend/src/bundle/assetCopier.ts`
- [x] Implement `copyAssets(storyId, shots, outputPath)` function
  - Create output directory structure: `<outputPath>/<storyId>/assets/shots/`
  - Copy image files from `public/generated/<storyId>/shots/<sceneletId>/<shotIndex>_key_frame.png`
  - Copy audio files from `public/generated/<storyId>/shots/<sceneletId>/<shotIndex>_audio.wav`
  - Handle missing audio files gracefully (log warning, set audioPath to null)
  - Handle missing image files gracefully (log warning, set imagePath to null)
  - Skip shots where both imagePath and audioPath are null (no assets to copy)
- [x] Implement `copyPlayerTemplate(templatePath, outputPath)` function
  - Copy player.html from template to `<outputPath>/<storyId>/player.html`
- [x] Write unit tests for assetCopier with temp directories

### 1.4 Player Bundle Task Implementation
- [x] Create `agent-backend/src/bundle/playerBundleTask.ts`
- [x] Implement `runPlayerBundleTask(storyId, dependencies, options)` function
  - Validate story exists
  - Validate story has generated shots (call shotsRepository.getShotsByStory)
  - Call bundleAssembler to generate JSON
  - Call assetCopier to copy images and audio
  - Call copyPlayerTemplate
  - Write story.json to `<outputPath>/<storyId>/story.json`
  - Return success result with output path
- [x] Handle errors with descriptive messages (missing prerequisites, file I/O errors)
- [x] Write integration tests with test fixtures

---

## Milestone 2: Workflow Integration

### 2.1 Workflow Task Type Registration
- [x] Update `agent-backend/src/workflow/types.ts`
  - Add `'CREATE_PLAYER_BUNDLE'` to `StoryWorkflowTask` union type
  - Add `PlayerBundleTaskOptions` to `AgentWorkflowOptions` interface
  - Add `runPlayerBundleTask?: (storyId, options) => Promise<result>` to options
- [x] Update `agent-backend/src/workflow/storyWorkflow.ts`
  - Add case for `CREATE_PLAYER_BUNDLE` in `runTask()` switch statement
  - Call `runPlayerBundleTask` with story ID and options
  - Validate prerequisites (shot production completed)

### 2.2 CLI Command Support
- [x] Update `agent-backend/src/cli/agentWorkflowCli.ts`
  - Add `--output-path` flag (string, optional, default: `/output/stories`)
  - Add `--overwrite` flag (boolean, optional, default: false)
  - Parse flags and pass to workflow options as `playerBundleTaskOptions`
- [x] Wire up CREATE_PLAYER_BUNDLE task in CLI task dispatcher
- [x] Add help text for bundle task flags

### 2.3 Default Dependencies Wiring
- [x] Create `agent-backend/src/bundle/index.ts` with default exports
- [x] In CLI, instantiate default bundle assembler and asset copier
- [x] Inject bundleAssembler and assetCopier into workflow options
- [x] Set default template path to `agent-backend/src/bundle/templates/player.html`

---

## Milestone 3: Standalone Player HTML/JS

### 3.1 Player Template Structure
- [x] Create `agent-backend/src/bundle/templates/` directory
- [x] Create `agent-backend/src/bundle/templates/player.html`
  - HTML5 boilerplate with meta tags (viewport, charset)
  - Container div for player UI
  - Audio element (hidden, for playback control)
  - Inline CSS for minimalist professional styling
  - Script tag for player.js (inline in same file for simplicity)
- [x] Design CSS for player box layout
  - Image container with max area, aspect ratio preservation
  - Bottom controls bar (play/pause button)
  - Overlay for start screen, choice UI, restart UI
  - Responsive breakpoints for mobile/tablet/desktop

### 3.2 Player State Management
- [x] Implement player state machine in vanilla JavaScript
  - States: `START`, `PLAYING_SHOT`, `WAITING_BRANCH`, `TERMINAL`, `INCOMPLETE`
  - State transitions triggered by user actions and playback events
- [x] Implement `loadStoryJson(url)` function
  - Fetch JSON from URL parameter or embedded window.STORY_DATA
  - Validate JSON structure
  - Display error if invalid
- [x] Implement `initializePlayer(storyData)` function
  - Set up state machine with root scenelet
  - Display start screen with story title

### 3.3 Shot Playback Logic
- [x] Implement `playShotSequence(scenelet, shotIndex)` function
  - Load and display shot image
  - Wait ramp-up grace period (500ms, configurable)
  - Load and play audio (if audioPath not null)
  - Wait for audio to finish
  - Wait ramp-down grace period (500ms)
  - Advance to next shot or state
- [x] Implement `playAudio(audioPath)` function
  - Set audio element src to path
  - Handle audio ended event
  - Handle errors gracefully (missing file)
- [x] Implement grace period timers with configurable delays

### 3.4 Auto-Play Linear Continuation
- [x] Implement `advanceToNextScenelet(sceneletId)` function
  - Load scenelet from story data
  - Begin playing first shot
- [x] Handle linear next.type: automatically call advanceToNextScenelet
- [x] Ensure no user interaction required for linear flow

### 3.5 Choice UI Implementation
- [x] Implement `displayChoiceUI(choicePrompt, choices)` function
  - Pause on last shot image
  - Render overlay with choice prompt at top center
  - Render choice options in horizontal layout (2 columns for binary choices)
  - Load first shot image of each target scenelet as thumbnail
  - Display choice label below thumbnail
- [x] Implement `onChoiceSelected(sceneletId)` event handler
  - Hide choice overlay
  - Load selected scenelet and begin playback
- [x] Style choice buttons for hover and click states

### 3.6 Terminal and Incomplete Ending UI
- [x] Implement `displayTerminalUI()` function
  - Pause on last shot image
  - Display "Start Over" button with icon
- [x] Implement `displayIncompleteUI()` function
  - Pause on last shot image
  - Do NOT display restart button (work-in-progress story)
  - Allow manual page reload to replay
- [x] Implement `onRestartClicked()` event handler
  - Reset state to START
  - Display start screen
  - Clear playback history

### 3.7 Playback Controls
- [x] Implement play/pause button toggle
  - Pause audio during shot playback
  - Resume audio from paused position
  - Prevent auto-advance while paused
- [x] Update button icon based on play/pause state
- [x] Position controls at bottom of player box

---

## Milestone 4: Testing and Validation

### 4.1 Backend Testing
- [x] Write unit tests for bundleAssembler edge cases
  - Missing root scenelet
  - Multiple root scenelets
  - Invalid next state references
  - Branch with only 1 child with assets (converts to linear)
  - Incomplete story (scenelets with no child assets)
  - Story with no scenelets having assets (should error)
- [x] Write unit tests for assetCopier file operations
  - Missing source image files (should warn, set to null)
  - Missing audio files (should warn, set to null)
  - Overwrite mode behavior
- [x] Write integration test for full playerBundleTask
  - Use test story with multiple scenelets and branches (complete)
  - Use test story with partial assets (incomplete)
  - Verify output folder structure
  - Verify JSON correctness (including "incomplete" next type)
  - Verify assets copied

### 4.2 CLI Testing
- [ ] Test CLI with real story (stub mode shots)
  - Run `run-task --task CREATE_PLAYER_BUNDLE --story-id <test-story> --mode stub`
  - Verify bundle created at `/output/stories/<test-story>/`
  - Verify player.html, story.json, and assets/ present
- [ ] Test CLI with custom output path
  - Run with `--output-path /tmp/test-bundle`
  - Verify bundle created at correct location
- [ ] Test CLI with overwrite flag
  - Create bundle twice with `--overwrite` on second run
  - Verify old bundle replaced

### 4.3 Player Manual Testing
- [ ] Open player.html in browser with test story
  - Verify start screen displays
  - Click "Start Story" and verify playback begins
- [ ] Test linear continuation flow
  - Verify shots auto-advance
  - Verify images and audio play correctly
- [ ] Test branching flow
  - Verify choice UI displays with prompt and thumbnails
  - Click each choice and verify correct branch loads
- [ ] Test terminal flow
  - Reach terminal scenelet
  - Click "Start Over" and verify return to start screen
- [ ] Test incomplete story flow
  - Bundle a story with partial assets
  - Verify playback stops at incomplete ending
  - Verify no "Start Over" button shown
- [ ] Test play/pause controls
  - Pause during audio playback
  - Resume and verify audio continues
- [ ] Test offline playback
  - Disable network
  - Open player.html locally
  - Verify all assets load from relative paths

### 4.4 Browser Compatibility Testing
- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test on mobile browsers (iOS Safari, Chrome Android)
- [ ] Verify responsive layout on different screen sizes

---

## Milestone 5: Documentation and Polish

### 5.1 Code Documentation
- [x] Add JSDoc comments to all public functions in bundle module
- [ ] Add TypeScript type annotations to all player.js functions
- [x] Document player.html template structure

### 5.2 User Documentation
- [x] Add README to `agent-backend/src/bundle/` explaining bundle structure
- [x] Document CLI usage for CREATE_PLAYER_BUNDLE task
- [x] Document expected output folder structure
- [ ] Document browser compatibility and requirements

### 5.3 Error Handling Polish
- [ ] Ensure all error messages are user-friendly and actionable
- [ ] Add validation error messages with specific field names
- [ ] Add file I/O error messages with file paths

### 5.4 OpenSpec Validation
- [x] Run `openspec validate add-standalone-player --strict`
- [x] Fix any validation errors
- [ ] Verify all requirements have scenarios
- [ ] Verify all scenarios use correct format
