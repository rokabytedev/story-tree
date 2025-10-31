# story-workflow Specification Deltas

## ADDED Requirements

### Requirement: Support Player Bundle Generation Task

The story workflow MUST support a CREATE_PLAYER_BUNDLE task that assembles story metadata and copies generated assets to a standalone output folder.

#### Scenario: Workflow registers player bundle task type
- **GIVEN** the StoryWorkflow enum of supported tasks
- **WHEN** a client queries available task types
- **THEN** CREATE_PLAYER_BUNDLE MUST be included in the StoryWorkflowTask union type
- **AND** the workflow MUST accept this task type in the runTask() method
- **AND** TypeScript compilation MUST enforce exhaustive task type handling

#### Scenario: Workflow invokes player bundle task runner
- **GIVEN** a story record with generated shots (images and audio)
- **WHEN** runTask('CREATE_PLAYER_BUNDLE') is called
- **THEN** the workflow MUST delegate to runPlayerBundleTask with the story ID and configured dependencies
- **AND** the workflow MUST pass through any task-specific options (outputPath, overwrite)
- **AND** the workflow MUST propagate task errors to the caller with context

#### Scenario: Task supports work-in-progress stories
- **GIVEN** a story record with some shots having assets and others missing assets
- **WHEN** runTask('CREATE_PLAYER_BUNDLE') is invoked
- **THEN** the task MUST bundle available shots and skip scenelets without any assets
- **AND** the task MUST log warnings for missing assets but continue execution
- **AND** the task MUST produce a valid bundle with partial content

---

### Requirement: Assemble Story Bundle JSON Metadata

The bundle task MUST transform database story records into a structured JSON format suitable for player consumption.

#### Scenario: Bundle JSON includes metadata section
- **GIVEN** a story with display_name and story_id
- **WHEN** the bundle assembler runs
- **THEN** the output JSON MUST include a metadata object with storyId, title, and exportedAt (ISO timestamp)
- **AND** the title MUST be taken from the story's display_name field
- **AND** the storyId MUST match the story's id

#### Scenario: Bundle JSON identifies root scenelet
- **GIVEN** a story with scenelets where one has parentId === null
- **WHEN** the bundle assembler runs
- **THEN** the output JSON MUST include a rootSceneletId field
- **AND** the rootSceneletId MUST reference the scenelet with no parent
- **AND** if multiple root scenelets exist it MUST throw a validation error

#### Scenario: Bundle JSON transforms scenelets to flat array
- **GIVEN** a story with N scenelets in the database
- **WHEN** the bundle assembler runs
- **THEN** the output JSON MUST include a scenelets array with N elements
- **AND** each element MUST have id, description, shots, and next fields
- **AND** the description MUST be extracted from scenelet.content.description

#### Scenario: Bundle JSON includes shot metadata with asset paths
- **GIVEN** a scenelet with M shots in the database
- **WHEN** the bundle assembler processes that scenelet
- **THEN** the scenelet's shots array MUST contain M shot objects
- **AND** each shot MUST have shotIndex, imagePath, and audioPath fields
- **AND** imagePath MUST be a relative path: `assets/shots/<scenelet-id>/<shot-index>_key_frame.png`
- **AND** audioPath MUST be a relative path: `assets/shots/<scenelet-id>/<shot-index>_audio.wav` or null if no audio exists

#### Scenario: Bundle JSON determines next state for linear scenelets
- **GIVEN** a scenelet that is not a branch point and not terminal (isBranchPoint: false, isTerminalNode: false)
- **WHEN** the bundle assembler processes the scenelet's next field
- **THEN** next.type MUST be "linear"
- **AND** next.sceneletId MUST reference the child scenelet (found via parentId lookup)
- **AND** if no child exists it MUST throw a validation error

#### Scenario: Bundle JSON determines next state for branching scenelets
- **GIVEN** a scenelet with isBranchPoint: true and a non-null choicePrompt
- **WHEN** the bundle assembler processes the scenelet's next field
- **THEN** next.type MUST be "branch"
- **AND** next.choicePrompt MUST be set to the scenelet's choicePrompt value
- **AND** next.choices MUST be an array of objects with label and sceneletId
- **AND** each choice.label MUST be taken from the child scenelet's choiceLabelFromParent
- **AND** each choice.sceneletId MUST reference the corresponding child scenelet id
- **AND** if fewer than 2 child scenelets exist it MUST throw a validation error

#### Scenario: Bundle JSON determines next state for terminal scenelets
- **GIVEN** a scenelet with isTerminalNode: true
- **WHEN** the bundle assembler processes the scenelet's next field
- **THEN** next.type MUST be "terminal"
- **AND** next.sceneletId, next.choicePrompt, and next.choices MUST not be present

---

### Requirement: Copy Generated Assets to Output Folder

The bundle task MUST copy all shot images and audio files from the public/generated directory to the bundle output folder with organized structure.

#### Scenario: Task creates output directory structure
- **GIVEN** a story with story_id "my-story"
- **WHEN** the bundle task runs with default output path
- **THEN** it MUST create the directory `/output/stories/my-story/`
- **AND** it MUST create subdirectory `/output/stories/my-story/assets/shots/`
- **AND** it MUST create parent directories if they do not exist

#### Scenario: Task copies shot images to output folder
- **GIVEN** a story with shots that have keyFrameImagePath set
- **WHEN** the asset copier runs
- **THEN** it MUST copy each image file from `public/generated/<story-id>/shots/<scenelet-id>/<shot-index>_key_frame.png`
- **AND** it MUST copy to `/output/stories/<story-id>/assets/shots/<scenelet-id>/<shot-index>_key_frame.png`
- **AND** it MUST create scenelet subdirectories as needed

#### Scenario: Task handles missing image files for incomplete stories
- **GIVEN** a shot has keyFrameImagePath set but the file does not exist
- **WHEN** the asset copier runs
- **THEN** it MUST log a warning indicating the missing image file
- **AND** it MUST continue copying other assets
- **AND** it MUST set the shot's imagePath to null in the JSON output

#### Scenario: Task copies shot audio to output folder
- **GIVEN** a story with shots that have audioFilePath set
- **WHEN** the asset copier runs
- **THEN** it MUST copy each audio file from `public/generated/<story-id>/shots/<scenelet-id>/<shot-index>_audio.wav`
- **AND** it MUST copy to `/output/stories/<story-id>/assets/shots/<scenelet-id>/<shot-index>_audio.wav`
- **AND** it MUST skip shots with null audioFilePath without throwing an error

#### Scenario: Task handles missing audio files gracefully
- **GIVEN** a shot has audioFilePath set but the file does not exist in public/generated
- **WHEN** the asset copier runs
- **THEN** it MUST log a warning indicating the missing audio file
- **AND** it MUST continue copying other assets
- **AND** it MUST set the shot's audioPath to null in the JSON output

---

### Requirement: Copy Player HTML Template to Output Folder

The bundle task MUST copy the standalone player HTML template to the output folder.

#### Scenario: Task copies player template
- **GIVEN** the player template exists at `agent-backend/src/bundle/templates/player.html`
- **WHEN** the bundle task runs
- **THEN** it MUST copy the template to `/output/stories/<story-id>/player.html`
- **AND** it MUST preserve the template content without modification

#### Scenario: Task fails if player template is missing
- **GIVEN** the player template file does not exist
- **WHEN** the bundle task runs
- **THEN** it MUST throw a descriptive error indicating the missing template
- **AND** it MUST not create the output folder or copy assets

---

### Requirement: Write Story Bundle JSON to Output Folder

The bundle task MUST write the assembled story bundle JSON to the output folder.

#### Scenario: Task writes story.json file
- **GIVEN** the bundle assembler has generated valid JSON
- **WHEN** the bundle task runs
- **THEN** it MUST write the JSON to `/output/stories/<story-id>/story.json`
- **AND** the JSON MUST be formatted with indentation for readability (2 spaces)
- **AND** the file MUST use UTF-8 encoding

#### Scenario: Task validates JSON before writing
- **GIVEN** the bundle assembler produces output
- **WHEN** the bundle task prepares to write story.json
- **THEN** it MUST validate that all sceneletId references are resolvable
- **AND** it MUST validate that all asset paths (imagePath, audioPath) have corresponding copied files
- **AND** it MUST throw a validation error if any references are broken

---

### Requirement: Support Bundle Task Options

The bundle task MUST support configuration options for output path and overwrite behavior.

#### Scenario: Default output path uses /output/stories
- **GIVEN** the bundle task is invoked without an outputPath option
- **WHEN** the task runs
- **THEN** it MUST use `/output/stories/<story-id>/` as the output directory

#### Scenario: Custom output path is respected
- **GIVEN** the bundle task is invoked with outputPath: "/custom/path"
- **WHEN** the task runs
- **THEN** it MUST create the bundle at `/custom/path/<story-id>/`
- **AND** it MUST create parent directories if needed

#### Scenario: Default mode stops if output folder exists
- **GIVEN** the output directory `/output/stories/<story-id>/` already exists
- **WHEN** the bundle task runs without overwrite flag
- **THEN** it MUST throw an error indicating the folder already exists
- **AND** it MUST not modify or delete existing files

#### Scenario: Overwrite mode replaces existing bundle
- **GIVEN** the output directory `/output/stories/<story-id>/` already exists
- **WHEN** the bundle task runs with overwrite: true
- **THEN** it MUST delete the existing directory
- **AND** it MUST create a fresh bundle with current story data

---

### Requirement: Handle Incomplete Story Trees

The bundle task MUST support bundling work-in-progress stories with partial assets by following the shortest available path and excluding scenelets without assets.

#### Scenario: Bundle excludes scenelets without any assets
- **GIVEN** a story where some scenelets have shots with no keyFrameImagePath and no audioFilePath
- **WHEN** the bundle assembler processes the story tree
- **THEN** it MUST exclude scenelets that have zero shots with at least one asset
- **AND** it MUST not include those scenelets in the scenelets array
- **AND** it MUST not reference excluded scenelets in any next.sceneletId or choice.sceneletId fields

#### Scenario: Bundle includes shots with partial assets
- **GIVEN** a shot has keyFrameImagePath but no audioFilePath
- **WHEN** the bundle assembler processes the shot
- **THEN** it MUST include the shot in the scenelet's shots array
- **AND** imagePath MUST be set to the relative path
- **AND** audioPath MUST be null

#### Scenario: Bundle follows shortest available path
- **GIVEN** a branching scenelet where only one branch has scenelets with assets
- **WHEN** the bundle assembler determines the next state
- **THEN** it MUST convert the branch to type "linear" pointing to the available child
- **AND** it MUST exclude the unavailable branch from the bundle

#### Scenario: Bundle handles non-terminal incomplete endings
- **GIVEN** a scenelet that is not marked as terminal but has no children with assets
- **WHEN** the bundle assembler determines the next state
- **THEN** it MUST set next.type to "incomplete" (new type)
- **AND** the player MUST handle "incomplete" type by stopping without showing restart button

#### Scenario: Bundle validates at least one scenelet with assets exists
- **GIVEN** a story where no scenelets have any shots with assets
- **WHEN** the bundle task runs
- **THEN** it MUST throw a descriptive error indicating no playable content
- **AND** it MUST not create the output folder

---

### Requirement: Workflow CLI Exposes Player Bundle Task

The workflow CLI MUST allow operators to run the player bundle generation task with output and overwrite options.

#### Scenario: CLI runs player bundle task
- **GIVEN** the CLI is invoked with `run-task --task CREATE_PLAYER_BUNDLE --story-id <id>`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST invoke the workflow's CREATE_PLAYER_BUNDLE task
- **AND** it MUST print success output with the bundle output path

#### Scenario: CLI supports custom output path
- **GIVEN** the CLI is invoked with `run-task --task CREATE_PLAYER_BUNDLE --output-path /my/custom/path`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST pass the custom output path to the bundle task options
- **AND** the bundle MUST be created at `/my/custom/path/<story-id>/`

#### Scenario: CLI supports overwrite flag
- **GIVEN** the CLI is invoked with `run-task --task CREATE_PLAYER_BUNDLE --overwrite`
- **WHEN** the CLI parses flags
- **THEN** it MUST interpret --overwrite as a boolean flag
- **AND** it MUST enable overwrite mode for the bundle task
- **AND** existing bundle folders MUST be replaced

#### Scenario: CLI validates story has required data
- **GIVEN** the CLI is invoked with a story that has no generated shots
- **WHEN** the bundle task runs
- **THEN** the CLI MUST display a descriptive error from the task
- **AND** the error MUST indicate which prerequisite tasks are missing
