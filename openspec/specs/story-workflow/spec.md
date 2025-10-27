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

#### Scenario: Interactive script task generates scenelets
- **GIVEN** the story has a stored constitution and no prior interactive generation
- **WHEN** the interactive script task runs
- **THEN** it MUST invoke the interactive generator with the story id, constitution markdown, and injected scenelet persistence
- **AND** it MUST persist generated scenelets via the persistence interface
- **AND** it MUST surface generator failures to the caller
- **AND** it MUST mark the task as completed so repeat invocations fail fast.

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
- **THEN** it MUST execute the supported tasks in the defined order (constitution then interactive script)
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

### Requirement: Schedule Storyboard Task
The workflow MUST expose a `CREATE_STORYBOARD` task that runs after visual design generation and persists the storyboard breakdown JSON onto the story record.

#### Scenario: runAllTasks executes storyboard after visual design
- **GIVEN** a story with stored constitution, generated scenelets, and a persisted visual design document
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke the storyboard task immediately after `CREATE_VISUAL_DESIGN`
- **AND** it MUST persist the validated Gemini payload into `stories.storyboard_breakdown`
- **AND** it MUST skip the task when `stories.storyboard_breakdown` is already populated.

#### Scenario: storyboard task validates prerequisites and response
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_STORYBOARD')` executes
- **THEN** it MUST throw a descriptive error if the story lacks a constitution, has no scenelets, lacks a visual design document, or already has a storyboard breakdown
- **AND** when prerequisites pass it MUST assemble the Gemini user prompt from the constitution, story tree YAML snapshot, and visual design document
- **AND** it MUST call Gemini with `system_prompts/storyboard_artist.md`, validate that every scenelet dialogue line maps to a shot using matching `scenelet_id` and `character` values from the visual design document, and persist the validated JSON via the stories repository.

### Requirement: Workflow CLI Exposes Storyboard Task
The workflow CLI MUST allow operators to run the storyboard task explicitly or as part of the full pipeline in both stub and real Gemini modes.

#### Scenario: CLI runs storyboard task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_STORYBOARD --mode stub`
- **WHEN** the storyboard fixtures are loaded
- **THEN** it MUST route the call to the workflow `CREATE_STORYBOARD` task using the stub Gemini response
- **AND** it MUST print success output upon persisting the storyboard breakdown.

### Requirement: Schedule Audio Design Task
The workflow MUST expose an audio design task that runs after storyboard generation and persists a validated audio design document.

#### Scenario: runAllTasks executes audio design after storyboard
- **GIVEN** a story with stored constitution, scenelets, visual design document, and storyboard breakdown but no audio design document
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke `CREATE_AUDIO_DESIGN` immediately after `CREATE_STORYBOARD`
- **AND** it MUST persist the Gemini output into `stories.audio_design_document`
- **AND** it MUST skip the task when `stories.audio_design_document` is already populated.

#### Scenario: audio design task validates prerequisites and response
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_AUDIO_DESIGN')` executes
- **THEN** it MUST throw a descriptive error when the story lacks a constitution, has no scenelets, lacks a visual design document, or already has an audio design document
- **AND** when prerequisites pass it MUST assemble the Gemini prompt from the constitution, story tree YAML snapshot, and visual design document using `system_prompts/audio_director.md`
- **AND** it MUST validate that every `character_voice_profiles[*].character_name` matches the visual design characters, every `associated_scenelet_ids[*]` matches the story tree ids, and required fields are non-empty before persisting via the stories repository.

### Requirement: Workflow CLI Exposes Audio Design Task
The workflow CLI MUST let operators run the audio design task directly or as part of the full pipeline in stub and real modes.

#### Scenario: CLI runs audio design task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_AUDIO_DESIGN --mode stub`
- **WHEN** the audio design Gemini fixture is loaded
- **THEN** it MUST route the call to the workflow `CREATE_AUDIO_DESIGN` task using the stub response
- **AND** it MUST print success output upon persisting the audio design document.

#### Scenario: CLI run-all uses compatible stub fixtures
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** the storyboard, visual design, and audio design fixtures are used
- **THEN** it MUST complete the full task pipeline without audio validation errors
- **AND** it MUST persist an audio design document that matches the stub fixture expectations.

