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
The workflow MUST expose a `CREATE_SHOT_PRODUCTION` task that runs after audio design and persists the validated shot list via the shots repository.

#### Scenario: runAllTasks executes shot production after audio design
- **GIVEN** a story with stored constitution, generated scenelets, and persisted visual and audio design documents but no stored shots
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke the shot production task immediately after `CREATE_AUDIO_DESIGN`
- **AND** it MUST call the shots repository to store every scenelet’s shots in order
- **AND** it MUST skip the task when the shots repository reports that all scenelets for the story already have stored shots.

#### Scenario: shot production task validates prerequisites and response
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_SHOT_PRODUCTION')` executes
- **THEN** it MUST throw a descriptive error if the story lacks a constitution, has no scenelets, lacks a visual or audio design document, or already has stored shots for any scenelet
- **AND** when prerequisites pass it MUST assemble the Gemini prompt from the constitution, story tree snapshot, visual design document, audio design document, and target scenelet
- **AND** it MUST call Gemini with `system_prompts/shot_director.md`, validate that every scenelet receives an ordered, gap-free shot list with compliant prompts, and persist the normalized shots via the shots repository.

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

