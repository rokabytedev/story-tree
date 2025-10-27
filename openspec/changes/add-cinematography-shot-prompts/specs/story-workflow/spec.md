## ADDED Requirements
### Requirement: Schedule Cinematography Prompt Task
The workflow MUST expose a `CREATE_SHOT_PROMPTS` task that runs after audio design and persists validated Gemini prompts for every storyboard shot.

#### Scenario: runAllTasks executes cinematography after audio design
- **GIVEN** a story with stored constitution, generated scenelets, and persisted visual design, storyboard, and audio design artifacts but no shot prompts
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke `CREATE_SHOT_PROMPTS` immediately after `CREATE_AUDIO_DESIGN`
- **AND** it MUST persist every newly generated prompt set via the stories repository layer responsible for shot prompts
- **AND** it MUST skip the task when all storyboard shots already have stored prompts.

#### Scenario: cinematography task validates prerequisites and response
- **GIVEN** `runTask('CREATE_SHOT_PROMPTS')` executes for a workflow handle
- **WHEN** the story lacks a storyboard breakdown, audio design document, or visual design document
- **THEN** it MUST throw an `AgentWorkflowError` describing the missing prerequisite
- **AND** when prerequisites pass it MUST iterate storyboard shots, assemble Gemini requests with the cinematography system prompt, parse the JSON response, require all three prompt strings to be non-empty, and persist each shot’s prompts
- **AND** it MUST refuse to overwrite an existing row for the same `scenelet_id`/`shot_index` pair.

### Requirement: Workflow CLI Exposes Cinematography Task
The workflow CLI MUST let operators run the cinematography task explicitly or as part of the full pipeline in both stub and real Gemini modes.

#### Scenario: CLI runs cinematography task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_PROMPTS --mode stub`
- **WHEN** cinematography fixtures are loaded
- **THEN** it MUST route the call to the workflow task using the stub Gemini responses
- **AND** it MUST report success after persisting prompts for each storyboard shot.

#### Scenario: CLI run-all covers cinematography
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** storyboard, audio design, and cinematography fixtures are provided
- **THEN** the pipeline MUST include `CREATE_SHOT_PROMPTS` after audio design and complete without duplicate-shot errors.
