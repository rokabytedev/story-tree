## ADDED Requirements
### Requirement: Provide Agent Workflow Orchestrator
The backend MUST expose a workflow function that takes a user prompt and coordinates story creation, constitution generation, and interactive scenelet generation.

#### Scenario: Workflow seeds story and stores prompt
- **GIVEN** a caller supplies a non-empty story prompt
- **WHEN** the workflow runs
- **THEN** it MUST create a new story row using the stories repository
- **AND** it MUST persist the prompt in the `initial_prompt` column for that story
- **AND** it MUST return the new story id.

### Requirement: Persist Constitution Output
The workflow MUST capture the Gemini-generated constitution and align the story row with the proposed title.

#### Scenario: Constitution saved with display name update
- **GIVEN** Gemini returns a constitution with `proposed_story_title` and `story_constitution_markdown`
- **WHEN** the workflow processes the response
- **THEN** it MUST store the markdown in `stories.story_constitution`
- **AND** it MUST update the story `display_name` to the proposed title using the repository.

### Requirement: Trigger Interactive Story Generation
The workflow MUST start interactive story generation once the constitution is saved so scenelets populate for the story.

#### Scenario: Interactive script generator invoked
- **GIVEN** the workflow has persisted the constitution
- **WHEN** it invokes the interactive script generator
- **THEN** it MUST provide the story id, constitution markdown, and injected scenelet persistence implementation
- **AND** it MUST surface generator failures to the caller.

### Requirement: Keep Orchestrator Testable
The workflow MUST separate business logic from IO so unit tests can run without real Supabase or Gemini dependencies.

#### Scenario: Dependencies injected for tests
- **GIVEN** a test supplies fake repositories and Gemini generators
- **WHEN** the workflow runs under test
- **THEN** it MUST rely solely on the injected dependencies
- **AND** it MUST avoid reading environment variables or instantiating real clients inside the business logic.
