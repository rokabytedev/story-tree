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

