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
The workflow MUST expose a `CREATE_SHOT_PRODUCTION` task that replaces the previous storyboard and cinematography tasks by iterating scenelets and persisting the ordered shot list (storyboard + prompts) per scenelet.

#### Scenario: runAllTasks executes shot production after audio design
- **GIVEN** a story with stored constitution, generated scenelets, and persisted visual and audio design artifacts but no stored shots
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke `CREATE_SHOT_PRODUCTION` immediately after `CREATE_AUDIO_DESIGN`
- **AND** it MUST persist each scenelet’s shots via the shots repository
- **AND** it MUST throw an error before starting if any scenelet already has stored shots.

#### Scenario: shot production task validates prerequisites and response
- **GIVEN** `runTask('CREATE_SHOT_PRODUCTION')` executes for a workflow handle
- **WHEN** the story lacks a constitution, interactive script scenelets, visual design, or audio design
- **THEN** it MUST throw an `AgentWorkflowError` describing the missing prerequisite
- **AND** when prerequisites pass it MUST iterate scenelets without stored shots, assemble Gemini requests with the combined system prompt, parse the JSON response for each scenelet, validate the ordered shot list, and persist it
- **AND** it MUST throw an error when invoked against a scenelet that already has stored shots unless a future reset workflow explicitly clears them first.

### Requirement: Workflow CLI exposes shot production task
The workflow CLI MUST let operators run the shot production task directly or as part of the full pipeline in stub and real Gemini modes.

#### Scenario: CLI runs shot production task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_PRODUCTION --mode stub`
- **WHEN** cinematography fixtures are loaded
- **THEN** it MUST route the call to the workflow task using the stub Gemini responses
- **AND** it MUST report success after persisting shots according to the responses.

#### Scenario: CLI run-all includes shot production
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** visual design, audio design, and shot production fixtures are provided
- **THEN** the pipeline MUST include `CREATE_SHOT_PRODUCTION` after audio design and complete without duplicating stored shots.
