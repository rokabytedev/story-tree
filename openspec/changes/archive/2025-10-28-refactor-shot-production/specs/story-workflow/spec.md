## MODIFIED Requirements
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
- **THEN** it MUST execute the supported tasks in the defined order (constitution, interactive script, visual design, audio design, shot production)
- **AND** it MUST surface the final constitution metadata for compatibility with existing callers.

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
- **AND** it MUST call Gemini with `system_prompts/create_shot_production.md`, validate that every scenelet receives an ordered, gap-free shot list with compliant prompts, and persist the normalized shots via the shots repository.

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
