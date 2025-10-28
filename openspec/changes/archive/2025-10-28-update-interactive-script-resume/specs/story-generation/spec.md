## MODIFIED Requirements
### Requirement: Depth-First Interactive Story Generation
The backend MUST expose a pure orchestration function that expands a story tree by exploring Gemini-generated scenelets depth-first using a stack of pending generation tasks.

#### Scenario: Resume seeds pending stack from stored scenelets
- **GIVEN** stored scenelets already describe part of the story tree
- **AND** the persistence layer reports additional branches are unfinished
- **WHEN** the generator runs in resume mode
- **THEN** it MUST seed the DFS stack with tasks derived from the stored scenelets so only missing branches are explored
- **AND** it MUST avoid recreating scenelets that already exist.

## ADDED Requirements
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
