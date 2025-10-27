## ADDED Requirements
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
