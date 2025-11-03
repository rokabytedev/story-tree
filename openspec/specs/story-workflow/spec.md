# story-workflow Specification

## Purpose
TBD - created by archiving change add-agent-workflow-orchestrator. Update Purpose after archive.
## Requirements
### Requirement: Provide Agent Workflow Orchestrator
The backend MUST expose workflow factories that either create a new story from a prompt or resume an existing story and return a stateless workflow handle.

#### Scenario: Create workflow from prompt
- **GIVEN** a caller supplies a non-empty story prompt
- **WHEN** the workflow factory runs
- **THEN** it MUST create a new story row via the stories repository
- **AND** it MUST persist the prompt in the `initial_prompt` column
- **AND** it MUST return a workflow object containing the new story id.

#### Scenario: Resume workflow for existing story
- **GIVEN** a caller supplies an existing story id
- **WHEN** the workflow factory runs
- **THEN** it MUST fetch the story via the repository
- **AND** it MUST throw an error if the story is missing
- **AND** it MUST return a workflow object containing only the story id.

### Requirement: Persist Constitution Output
The workflow MUST capture the Gemini-generated constitution and align the story row with the proposed title when the `CREATE_CONSTITUTION` task runs.

#### Scenario: Constitution task saves artifacts
- **GIVEN** the constitution task runs for a story without a stored constitution
- **WHEN** Gemini returns `proposed_story_title` and `story_constitution_markdown`
- **THEN** the workflow MUST store the markdown in `stories.story_constitution`
- **AND** it MUST update the story `display_name` to the proposed title using the repository
- **AND** it MUST mark the task as completed so repeat invocations fail fast.

### Requirement: Trigger Interactive Story Generation
The workflow MUST populate scenelets when the `CREATE_INTERACTIVE_SCRIPT` task runs for a story that already has a constitution.

#### Scenario: Resume completes partially generated trees
- **GIVEN** a story already has persisted scenelets but the workflow is invoked with resume mode enabled
- **WHEN** the interactive script task runs
- **THEN** it MUST inspect the stored scenelets, resume generation for unfinished branches, and exit successfully when the tree is complete
- **AND** it MUST leave existing scenelets untouched.

### Requirement: Keep Orchestrator Testable
The workflow MUST separate business logic from IO so unit tests can run without real Supabase or Gemini dependencies for each task.

#### Scenario: Dependencies injected for tasks
- **GIVEN** tests supply fake repositories, constitution generator, and interactive generator
- **WHEN** any workflow task runs under test
- **THEN** it MUST rely solely on the injected dependencies
- **AND** it MUST avoid reading environment variables or instantiating real clients inside the business logic.

### Requirement: Task-Based Execution
The workflow MUST expose `runTask` and `runAllTasks` so callers can execute individual tasks or the full sequence.

#### Scenario: Run single task
- **GIVEN** a workflow handle and a task identifier
- **WHEN** `runTask` is invoked
- **THEN** it MUST validate task prerequisites using current repository state
- **AND** it MUST execute the matching task implementation
- **AND** it MUST throw an error if the task was already completed.

#### Scenario: Run all tasks sequentially
- **GIVEN** a workflow handle
- **WHEN** `runAllTasks` is invoked
- **THEN** it MUST execute the supported tasks in the defined order (constitution, interactive script, visual design, visual reference, audio design, shot production)
- **AND** it MUST surface the final constitution metadata for compatibility with existing callers.

### Requirement: Schedule Visual Design Task
The workflow MUST expose a `CREATE_VISUAL_DESIGN` task that runs after interactive script generation and persists the resulting visual design document.

#### Scenario: runAllTasks executes visual design after interactive script
- **GIVEN** a story with a stored constitution and generated interactive script scenelets
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke the visual design task immediately after `CREATE_INTERACTIVE_SCRIPT`
- **AND** it MUST persist the Gemini response into `stories.visual_design_document`
- **AND** it MUST skip the task when `stories.visual_design_document` is already populated.

#### Scenario: visual design task validates prerequisites
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_VISUAL_DESIGN')` executes
- **THEN** it MUST throw an error if the story lacks a constitution, has no stored scenelets, or already has a visual design document
- **AND** when prerequisites pass it MUST load the constitution, assemble the interactive script tree payload, call Gemini with the visual design system prompt, and persist the returned JSON via the stories repository.

### Requirement: Schedule Shot Production Task
The shot production task MUST generate shots with enhanced storyboard entries containing explicit design references and structured audio/narrative data instead of flat dialogue arrays.

#### Scenario: Shot director produces referenced_designs field
- **GIVEN** the shot production task runs for a scenelet
- **WHEN** Gemini returns the shot storyboard entry
- **THEN** it MUST include a `referenced_designs` object with `characters` and `environments` string arrays
- **AND** the character IDs MUST match `character_id` values from the visual design document
- **AND** the environment IDs MUST match `environment_id` values from the visual design document.

#### Scenario: Shot director produces audio_and_narrative field
- **GIVEN** the shot production task runs for a scenelet with dialogue
- **WHEN** Gemini returns the shot storyboard entry
- **THEN** it MUST include an `audio_and_narrative` array instead of a flat `dialogue` array
- **AND** each entry MUST have `type` field with value "monologue" or "dialogue"
- **AND** monologue entries MUST have `source` field set to "narrator"
- **AND** dialogue entries MUST have `source` field set to a valid `character_id` from the visual design document
- **AND** each entry MUST have a `line` field containing the text with performance notes in parentheticals.

#### Scenario: Shot production validates new storyboard structure
- **GIVEN** Gemini returns a shot production response
- **WHEN** the parser validates the storyboard entry
- **THEN** it MUST reject entries missing the `referenced_designs` object
- **AND** it MUST reject entries missing the `audio_and_narrative` array
- **AND** it MUST reject audio entries with invalid `type` values
- **AND** it MUST reject dialogue entries where `source` does not match a character_id in the visual design document
- **AND** it MUST reject monologue entries where `source` is not "narrator".

### Requirement: Workflow CLI Exposes Shot Production Task
The workflow CLI MUST allow operators to run the shot production task explicitly or as part of the full pipeline in both stub and real Gemini modes.

#### Scenario: CLI runs shot production task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_PRODUCTION --mode stub`
- **WHEN** the shot production fixtures are loaded
- **THEN** it MUST route the call to the workflow `CREATE_SHOT_PRODUCTION` task using the stub Gemini response
- **AND** it MUST print success output after persisting the generated shots.

#### Scenario: CLI run-all includes shot production
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** visual design, audio design, and shot production fixtures are provided
- **THEN** the pipeline MUST include `CREATE_SHOT_PRODUCTION` after audio design and complete without duplicating stored shots.

### Requirement: Schedule Audio Design Task
The workflow MUST expose an audio design task that runs after visual design generation and persists a validated audio design document.

#### Scenario: runAllTasks executes audio design after visual reference
- **GIVEN** a story with stored constitution, generated scenelets, a visual design document, and a visual reference package but no audio design document
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke `CREATE_AUDIO_DESIGN` immediately after `CREATE_VISUAL_REFERENCE`
- **AND** it MUST persist the Gemini output into `stories.audio_design_document`
- **AND** it MUST skip the task when `stories.audio_design_document` is already populated.

### Requirement: Workflow CLI Exposes Audio Design Task
The workflow CLI MUST let operators run the audio design task directly or as part of the full pipeline in stub and real modes.

#### Scenario: CLI runs audio design task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_AUDIO_DESIGN --mode stub`
- **WHEN** the audio design Gemini fixture is loaded
- **THEN** it MUST route the call to the workflow `CREATE_AUDIO_DESIGN` task using the stub response
- **AND** it MUST print success output upon persisting the audio design document.

#### Scenario: CLI run-all uses compatible stub fixtures
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** the visual design, audio design, and shot production fixtures are used
- **THEN** it MUST complete the full task pipeline without validation errors
- **AND** it MUST persist an audio design document and scenelet shots that match the stub fixture expectations.

### Requirement: Schedule Visual Reference Task
The workflow MUST expose a `CREATE_VISUAL_REFERENCE` task that runs after visual design generation and persists the validated visual reference package.

#### Scenario: runAllTasks executes visual reference after visual design
- **GIVEN** a story with a stored constitution, generated scenelets, and a visual design document but no visual reference package
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke `CREATE_VISUAL_REFERENCE` immediately after `CREATE_VISUAL_DESIGN`
- **AND** it MUST persist the validated package into `stories.visual_reference_package`
- **AND** it MUST skip the task when `stories.visual_reference_package` already contains data.

#### Scenario: visual reference task validates prerequisites
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_VISUAL_REFERENCE')` executes
- **THEN** it MUST throw a descriptive error if the story lacks a constitution, has no stored scenelets, lacks a visual design document, or already has a visual reference package
- **AND** when prerequisites pass it MUST load the constitution, assemble the story tree payload, call Gemini with the visual reference system prompt, validate the response, and persist the package via the stories repository.

### Requirement: Workflow CLI Exposes Visual Reference Task
The workflow CLI MUST allow operators to run the visual reference task explicitly or as part of the full pipeline in both stub and real Gemini modes.

#### Scenario: CLI runs visual reference task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_VISUAL_REFERENCE --mode stub`
- **WHEN** the visual reference fixtures are loaded
- **THEN** it MUST route the call to the workflow `CREATE_VISUAL_REFERENCE` task using the stub Gemini response
- **AND** it MUST print success output after persisting the generated visual reference package.

#### Scenario: CLI run-all includes visual reference
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** constitution, interactive script, visual design, and visual reference fixtures are provided
- **THEN** the pipeline MUST include `CREATE_VISUAL_REFERENCE` after visual design and before audio design and complete without duplicating stored artifacts.

### Requirement: Workflow CLI Supports Interactive Script Resume
The workflow CLI MUST let operators request resume mode for the interactive script task.

#### Scenario: CLI forwards resume flag for interactive script task
- **GIVEN** an operator runs `run-task --task CREATE_INTERACTIVE_SCRIPT --resume-interactive-script`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST enable resume mode on the workflow before invoking the task
- **AND** it MUST surface the task outcome according to normal CLI behaviour.

### Requirement: Support Environment Reference Image Generation Task
The story workflow MUST support a CREATE_ENVIRONMENT_REFERENCE_IMAGE task that generates structured environment reference images for story environments.

#### Scenario: Workflow registers environment reference image task type
- **GIVEN** the StoryWorkflow enum of supported tasks
- **WHEN** a client queries available task types
- **THEN** CREATE_ENVIRONMENT_REFERENCE_IMAGE MUST be included in the StoryWorkflowTask union type
- **AND** the workflow MUST accept this task type in the runTask() method
- **AND** TypeScript compilation MUST enforce exhaustive task type handling

#### Scenario: Workflow invokes environment reference image task runner
- **GIVEN** a story record with a persisted visual design document
- **WHEN** runTask('CREATE_ENVIRONMENT_REFERENCE_IMAGE') is called
- **THEN** the workflow MUST delegate to runEnvironmentReferenceTask with the story ID and configured dependencies
- **AND** the workflow MUST pass through any task-specific options (targetEnvironmentId, override, resume)
- **AND** the workflow MUST propagate task errors to the caller with context

#### Scenario: Task requires visual design document prerequisite
- **GIVEN** a story record without a visual_design_document
- **WHEN** runTask('CREATE_ENVIRONMENT_REFERENCE_IMAGE') is invoked
- **THEN** the task runner MUST throw a descriptive error before attempting image generation
- **AND** the error message MUST indicate that CREATE_VISUAL_DESIGN must complete first

#### Scenario: CLI supports environment reference image command
- **GIVEN** the agentWorkflowCli command parser
- **WHEN** a user invokes `run-task --story-id <id> --task CREATE_ENVIRONMENT_REFERENCE_IMAGE`
- **THEN** the CLI MUST parse the command successfully
- **AND** the CLI MUST support optional `--environment-id <id>` flag for single-environment targeting
- **AND** the CLI MUST support optional `--override <true|false>` flag (default: false)
- **AND** the CLI MUST support optional `--resume` flag for batch mode
- **AND** the CLI MUST validate that --resume is only used without --environment-id
- **AND** the CLI MUST invoke the workflow's runTask method with parsed parameters

#### Scenario: Task integrates with workflow options
- **GIVEN** AgentWorkflowOptions interface
- **WHEN** initializing a workflow with environment reference task dependencies
- **THEN** AgentWorkflowOptions MUST include an optional environmentReferenceTaskOptions field
- **AND** AgentWorkflowOptions MUST include an optional runEnvironmentReferenceTask field for dependency injection
- **AND** the options MUST follow the pattern of other task options (visual design, character model sheet, etc.)

### Requirement: Assemble Key Frame Prompts from Storyboard Artifacts
The shot image generation task MUST assemble key frame prompts directly from storyboard metadata, visual design, and audio design documents instead of using pre-generated prompt strings.

#### Scenario: Image prompt assembly filters design assets
- **GIVEN** a shot record with `referenced_designs` containing specific character and environment IDs
- **WHEN** the key frame prompt assembler runs
- **THEN** it MUST extract `global_aesthetic` (visual_style and master_color_palette) from the visual design document
- **AND** it MUST filter `character_designs` to include only those with `character_id` matching the shot's `referenced_designs.characters`
- **AND** it MUST filter `environment_designs` to include only those with `environment_id` matching the shot's `referenced_designs.environments`
- **AND** the assembled prompt MUST combine the filtered design data with the shot's storyboard metadata.

#### Scenario: Image prompt excludes audio narrative
- **GIVEN** a shot record with an `audio_and_narrative` field
- **WHEN** the key frame prompt assembler runs
- **THEN** it MUST exclude the `audio_and_narrative` field from the assembled prompt sent to image generation
- **AND** it MUST include all other storyboard fields (framing_and_angle, composition_and_content, character_action_and_emotion, camera_dynamics, lighting_and_atmosphere, continuity_notes, referenced_designs).

#### Scenario: Image generation uses assembled prompt object
- **GIVEN** an assembled key frame prompt object
- **WHEN** the shot image task calls Gemini image generation
- **THEN** it MUST serialize the assembled prompt object to JSON
- **AND** it MUST pass the JSON as the `userPrompt` parameter
- **AND** it MUST use the existing `visual_renderer.md` system prompt without modification
- **AND** it MUST load reference images based on the `referenced_designs` character and environment IDs.

### Requirement: Generate Shot Audio with Multi-Speaker TTS
The workflow MUST expose a `CREATE_SHOT_AUDIO` task that generates speech audio for shots using Gemini's multi-speaker TTS API based on shot narratives and voice profiles.

#### Scenario: Audio generation task validates prerequisites
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_SHOT_AUDIO')` executes
- **THEN** it MUST throw a descriptive error if the story lacks an audio design document
- **AND** it MUST throw a descriptive error if the story has no generated shots
- **AND** when prerequisites pass it MUST load the audio design document, fetch shots, and proceed with audio generation

#### Scenario: Audio generation uses single-speaker mode for one source
- **GIVEN** a shot with audioAndNarrative entries having only one unique source value (narrator or one character)
- **WHEN** the audio generation task processes the shot
- **THEN** it MUST use Gemini TTS single-speaker mode with model `"gemini-2.5-flash-preview-tts"`
- **AND** it MUST configure the speaker name as the character_id from audio design document
- **AND** it MUST configure the voice name from the matching voice profile's voice_name field
- **AND** it MUST assemble the prompt including only the relevant voice profile and the shot's audioAndNarrative array
- **AND** when `--verbose` flag is enabled it MUST log the full request details (model, prompt, speaker config) without logging binary audio response data

#### Scenario: Audio generation uses multi-speaker mode for two sources
- **GIVEN** a shot with audioAndNarrative entries having exactly two unique source values
- **WHEN** the audio generation task processes the shot
- **THEN** it MUST use Gemini TTS multi-speaker mode with model `"gemini-2.5-flash-preview-tts"`
- **AND** it MUST configure two speaker voice configs with speaker names matching character_id values
- **AND** it MUST use voice_name values from the matching character_voice_profiles in audio design document
- **AND** it MUST include narrator_voice_profile if "narrator" is one of the sources
- **AND** when `--verbose` flag is enabled it MUST log request details with both speaker configurations without logging binary audio response data

#### Scenario: Audio generation rejects shots with three or more speakers
- **GIVEN** a shot with audioAndNarrative entries having three or more unique source values
- **WHEN** the audio generation task processes the shot
- **THEN** it MUST throw a validation error indicating unsupported speaker count
- **AND** it MUST include the shot identifier (scenelet_id and shot_index) in the error message
- **AND** it MUST NOT generate audio for that shot

#### Scenario: Audio generation stores WAV files in public directory
- **GIVEN** Gemini TTS returns audio data for a shot
- **WHEN** the audio generation task saves the file
- **THEN** it MUST save the WAV file to `apps/story-tree-ui/public/generated/<story-id>/shots/<scenelet-id>/<shot-index>_audio.wav`
- **AND** it MUST update the shot's audio_file_path in the database with the relative path `generated/<story-id>/shots/<scenelet-id>/<shot-index>_audio.wav`
- **AND** it MUST create parent directories if they do not exist

#### Scenario: Default mode stops on existing audio
- **GIVEN** the audio generation task runs in default mode (no flags)
- **WHEN** ANY shot in the target scope already has audio_file_path set in the database
- **THEN** the task MUST stop immediately without generating any audio
- **AND** it MUST throw a descriptive error indicating existing audio was found

#### Scenario: Resume mode skips shots with existing audio
- **GIVEN** the audio generation task runs in resume mode (--resume flag)
- **WHEN** the task processes shots
- **THEN** it MUST skip shots that already have audio_file_path set
- **AND** it MUST generate audio only for shots without audio_file_path
- **AND** it MUST log skipped shots for visibility

#### Scenario: Override mode regenerates all shot audio
- **GIVEN** the audio generation task runs in override mode (--override flag)
- **WHEN** the task processes shots
- **THEN** it MUST regenerate audio for ALL shots in the target scope
- **AND** it MUST replace existing audio files and database paths
- **AND** it MUST NOT skip shots with existing audio_file_path

#### Scenario: Batch mode generates audio for entire story
- **GIVEN** the audio generation task is invoked without scenelet-id or shot-index targeting
- **WHEN** the task executes
- **THEN** it MUST fetch all shots for the story grouped by scenelet
- **AND** it MUST process shots sequentially in scenelet_sequence and shot_index order
- **AND** it MUST apply the configured mode (default/resume/override) to all shots

#### Scenario: Single-shot mode generates audio for specific shot
- **GIVEN** the audio generation task is invoked with both --scenelet-id and --shot-index flags
- **WHEN** the task executes
- **THEN** it MUST generate audio only for the shot matching the provided scenelet_id and shot_index
- **AND** it MUST apply the configured mode to that single shot
- **AND** it MUST throw an error if the shot does not exist

#### Scenario: Scenelet batch mode generates audio for one scenelet
- **GIVEN** the audio generation task is invoked with --scenelet-id flag but no --shot-index
- **WHEN** the task executes
- **THEN** it MUST fetch all shots for the specified scenelet
- **AND** it MUST process those shots sequentially by shot_index
- **AND** it MUST apply the configured mode to all shots in that scenelet

### Requirement: Workflow CLI Exposes Shot Audio Task
The workflow CLI MUST allow operators to run the shot audio generation task with mode flags and targeting options in both stub and real Gemini modes.

#### Scenario: CLI runs shot audio task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --mode stub`
- **WHEN** the stub Gemini TTS client is loaded
- **THEN** it MUST route the call to the workflow `CREATE_SHOT_AUDIO` task using stub audio data
- **AND** it MUST save stub WAV files to the public directory
- **AND** it MUST print success output after updating database with audio paths

#### Scenario: CLI supports resume flag for audio generation
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --resume`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST enable resume mode for the audio generation task
- **AND** the task MUST skip shots with existing audio_file_path

#### Scenario: CLI supports override flag as boolean
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --override`
- **WHEN** the CLI parses flags
- **THEN** it MUST interpret --override as a boolean flag without requiring a value
- **AND** it MUST enable override mode for the audio generation task
- **AND** the task MUST regenerate audio for all targeted shots

#### Scenario: CLI supports single-shot targeting
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --scenelet-id intro-scene --shot-index 2`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST pass both scenelet-id and shot-index to the task options
- **AND** the task MUST generate audio only for that specific shot

#### Scenario: CLI run-all includes shot audio generation
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** the full pipeline executes
- **THEN** it MUST include `CREATE_SHOT_AUDIO` after `CREATE_SHOT_IMAGES`
- **AND** it MUST use stub TTS client for audio generation
- **AND** it MUST complete without errors when audio design document exists

### Requirement: Audio Design Document Schema Updates
The audio design document schema MUST include character_id and voice_name fields in character voice profiles and a top-level narrator_voice_profile field for narrator voice configuration.

#### Scenario: Character voice profiles include character_id
- **GIVEN** an audio design document is generated or loaded
- **WHEN** the audio design response validator processes character_voice_profiles
- **THEN** each profile MUST have a `character_id` field generated using `normalizeNameToId(character_name)` from `visual-design/utils.ts`
- **AND** both `character_id` and `character_name` fields MUST be preserved in the validated document
- **AND** the character_id MUST be used as the speaker name in Gemini TTS API calls

#### Scenario: Character voice profiles include voice_name
- **GIVEN** an audio design document is generated or loaded
- **WHEN** the document's character_voice_profiles array is validated
- **THEN** each profile MUST include a `voice_name` field specifying a Gemini TTS prebuilt voice (e.g., "Kore", "Puck")
- **AND** the voice_name MUST be used in the prebuiltVoiceConfig for Gemini TTS API calls
- **AND** the validator MUST reject profiles missing the voice_name field

#### Scenario: Audio design document includes narrator_voice_profile at top level
- **GIVEN** an audio design document is generated or loaded
- **WHEN** the document structure is validated
- **THEN** it MUST include a `narrator_voice_profile` field at the top level (not in character_voice_profiles array)
- **AND** the narrator_voice_profile MUST include `character_id: "narrator"`, `voice_name`, and `voice_profile` fields
- **AND** the narrator_voice_profile MUST be used when audioAndNarrative includes source: "narrator"
- **AND** the validator MUST reject documents missing narrator_voice_profile or missing required fields

#### Scenario: Audio generation validates voice profile presence
- **GIVEN** a shot references a character_id in its audioAndNarrative
- **WHEN** the audio generation task assembles the TTS prompt
- **THEN** it MUST throw a validation error if no matching character_voice_profile exists
- **AND** it MUST throw a validation error if the profile is missing voice_name or character_id
- **AND** it MUST throw a validation error if narrator is referenced but narrator_voice_profile is missing

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

### Requirement: Provide Embedded Player Bundle Accessor
The story workflow MUST expose an accessor that assembles player bundle data for embedded surfaces without copying assets.
#### Scenario: Embedded accessor returns generated asset URLs
- **GIVEN** a story has playable shots stored under `apps/story-tree-ui/public/generated/{storyId}/`
- **WHEN** the embedded accessor is invoked with that story id
- **THEN** it MUST return the same StoryBundle shape produced for the standalone player
- **AND** every shot imagePath and audioPath in the returned bundle MUST resolve to `/generated/{storyId}/shots/{sceneletId}/{shotIndex}_key_frame.png` and `/generated/{storyId}/shots/{sceneletId}/{shotIndex}_audio.wav` (or null when absent)
- **AND** music cues, when present, MUST resolve to `/generated/{storyId}/music/{cueName}.m4a`

#### Scenario: Embedded accessor reuses bundle assembler and avoids asset copies
- **GIVEN** the embedded accessor assembles data
- **WHEN** it runs
- **THEN** it MUST call `assembleBundleJson` with a manifest override instead of duplicating bundle logic
- **AND** it MUST NOT copy or mutate files under `/output/stories`
- **AND** it MUST surface the same validation errors as the standalone bundle task when playable assets are missing

