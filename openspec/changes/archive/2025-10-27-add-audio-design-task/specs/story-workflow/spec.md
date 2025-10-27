## ADDED Requirements
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
