# story-generation Specification

## Purpose
TBD - created by archiving change add-interactive-story-generation. Update Purpose after archive.
## Requirements
### Requirement: Depth-First Interactive Story Generation
The backend MUST expose a pure orchestration function that expands a story tree by exploring Gemini-generated scenelets depth-first using a stack of pending generation tasks.

#### Scenario: Resume seeds pending stack from stored scenelets
- **GIVEN** stored scenelets already describe part of the story tree
- **AND** the persistence layer reports additional branches are unfinished
- **WHEN** the generator runs in resume mode
- **THEN** it MUST seed the DFS stack with tasks derived from the stored scenelets so only missing branches are explored
- **AND** it MUST avoid recreating scenelets that already exist.

### Requirement: Branch and Conclusion Handling
The generator MUST interpret Gemini responses to continue linearly, branch into choices, or conclude a path, and persist corresponding metadata.

#### Scenario: Branch response spawns multiple tasks
- **GIVEN** Gemini returns a response with `branch_point: true`
- **WHEN** the generator processes the payload
- **THEN** it MUST mark the parent scenelet as a branch point with the provided `choice_prompt`
- **AND** it MUST persist each choice scenelet with its `choice_label`
- **AND** it MUST push separate tasks for each choice so the DFS traversal eventually explores both paths.

#### Scenario: Concluding response ends path
- **GIVEN** Gemini marks `is_concluding_scene: true`
- **WHEN** the generator saves the concluding scenelet
- **THEN** it MUST flag the scenelet as terminal in storage
- **AND** it MUST avoid pushing additional tasks for that branch.

### Requirement: Gemini Interactive Scriptwriter Invocation
The generator MUST call Gemini with the `system_prompts/interactive_scriptwriter.md` prompt, the current path context, and an instruction that distinguishes the root versus continuation scenelets.

#### Scenario: Prompt formatted for root and continuation
- **GIVEN** the orchestrator prepares a Gemini request
- **WHEN** the task has no prior scenelets
- **THEN** it MUST issue user content that includes the story constitution and a root instruction without a current path section
- **AND** when prior scenelets exist it MUST include the serialized path context and a continuation instruction so Gemini receives the full narrative history.

### Requirement: Robust Gemini Response Validation
The generator MUST validate Gemini JSON before attempting persistence and surface descriptive errors when payloads are malformed or missing required fields.

#### Scenario: Malformed Gemini payload triggers error
- **GIVEN** Gemini returns text that cannot be parsed as the expected JSON schema
- **WHEN** the orchestrator attempts to process it
- **THEN** it MUST throw an error that identifies the interactive script generation operation and includes the raw response text for debugging (with secrets redacted).

### Requirement: Gemini Invocation Resilience
The interactive story generator MUST retry Gemini JSON invocations with exponential backoff so transient failures do not terminate the task.

#### Scenario: Retry handles transient Gemini error
- **GIVEN** Gemini returns a retryable error (e.g., 429 with retry-after metadata)
- **WHEN** the generator calls the retry helper
- **THEN** it MUST schedule the next attempt using exponential backoff capped by the configured maximum delay
- **AND** it MUST honour the retry-after window when it exceeds the computed delay
- **AND** it MUST stop retrying once the maximum attempts are exhausted and surface a descriptive error.

#### Scenario: Non-retryable Gemini error surfaces immediately
- **GIVEN** Gemini responds with a client-side validation error
- **WHEN** the generator processes the failure
- **THEN** it MUST skip retries and throw the error so operators can address the underlying issue.

