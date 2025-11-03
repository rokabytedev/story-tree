# story-constitution Specification

## Purpose
TBD - created by archiving change add-gemini-story-constitution. Update Purpose after archive.
## Requirements
### Requirement: Organise Agent Backend Workspace
Agent workflow code MUST live in a dedicated root-level directory named `agent-backend/` that houses shared Gemini utilities and story constitution logic.

#### Scenario: Directory structure established
- **GIVEN** the project root
- **WHEN** the story constitution capability is added
- **THEN** a new `agent-backend/` directory MUST contain the Gemini client and story constitution modules
- **AND** the legacy `src/ai/` path MUST remain unused for this workflow.

### Requirement: Provide Shared Gemini Client Factory
A reusable Gemini client factory in `agent-backend/` MUST centralise model selection, long timeouts, thinking configuration, and error mapping.

#### Scenario: Client factory usage
- **GIVEN** the story constitution function needs to call Gemini
- **WHEN** it resolves a client
- **THEN** it MUST do so via the shared factory
- **AND** the factory MUST inject the configured timeout, thinking budget, and model name consistently.

### Requirement: Generate Story Constitution With Gemini
The backend MUST expose a TypeScript function that accepts a short story description, loads the `system_prompts/create_story_constitution.md` text as the system instruction, and invokes Gemini via the shared client to create a story constitution JSON response.

#### Scenario: Invoke Gemini With system prompt and long timeout
- **GIVEN** the caller supplies a non-empty story brief
- **WHEN** the function executes
- **THEN** it MUST load the full contents of `system_prompts/create_story_constitution.md`
- **AND** it MUST call the configured Gemini model using that content as the system instruction and the brief as the user content through the shared client factory
- **AND** it MUST apply a timeout suitable for multi-minute generations and pass through thinking budget configuration required by the prompt.

### Requirement: Return Parsed Story Constitution JSON
The function MUST validate and return Gemini's JSON output as a typed object containing the proposed title, markdown constitution, and the scenelet target per path.

#### Scenario: Target scenelet count surfaced
- **GIVEN** Gemini returns a payload that includes `target_scenelets_per_path`
- **WHEN** the constitution generator parses the response
- **THEN** it MUST expose the integer as `targetSceneletsPerPath` in the returned object
- **AND** the value MUST be persisted untouched when the constitution is stored.

#### Scenario: Default target length applied
- **GIVEN** the user's prompt omits an explicit length request
- **WHEN** the story constitution is generated
- **THEN** the system prompt MUST instruct Gemini to default the target to 12 scenelets per path
- **AND** the parsed response MUST provide `target_scenelets_per_path: 12`.

#### Scenario: Story length requests convert to scenelet targets
- **GIVEN** the user specifies a desired runtime (e.g., "a 10 minute story") or scenelet count
- **WHEN** the constitution prompt is assembled
- **THEN** it MUST instruct Gemini to translate minutes into scenelets at a 2:1 ratio or to use the provided count directly
- **AND** the returned `target_scenelets_per_path` MUST reflect that computed value.

### Requirement: Distinguish Gemini Rate Limit Errors
Gemini rate limit or resource exhaustion responses MUST surface as a dedicated retryable error type shared across Gemini integrations.

#### Scenario: Gemini rate limit encountered
- **GIVEN** Gemini returns a rate-limit or resource-exhausted error
- **WHEN** the function handles the failure
- **THEN** it MUST throw the shared retryable rate-limit error type
- **AND** it MUST include metadata (e.g. retry-after if available) to help upstream schedulers back off.

### Requirement: Propagate Other Gemini Failures
Non-rate-limit Gemini failures MUST propagate with actionable context and preserve the original error details.

#### Scenario: Unexpected Gemini error
- **GIVEN** Gemini returns any other error (network fault, invalid request, internal error)
- **WHEN** the function handles the failure
- **THEN** it MUST wrap or rethrow the error with context identifying the story constitution operation
- **AND** it MUST include Gemini's diagnostic information for observability while avoiding sensitive data leakage.

### Requirement: Provide Manual Testing CLI
A developer CLI MUST exist to invoke the story constitution workflow with a user-provided brief without hitting real Gemini endpoints.

#### Scenario: CLI invocation
- **GIVEN** a developer wants to manually test the story constitution workflow
- **WHEN** they run the CLI with a story brief
- **THEN** the CLI MUST load a fake or stubbed Gemini response
- **AND** it MUST print the parsed story constitution result for inspection.

### Requirement: Stubbed Tests
Automated tests MUST validate the story constitution workflow using stubbed Gemini responses rather than live API calls.

#### Scenario: Automated tests run
- **GIVEN** the test suite executes
- **WHEN** the story constitution tests run
- **THEN** they MUST rely on stubbed or recorded responses for success, malformed JSON, and rate-limit errors
- **AND** they MUST NOT perform live Gemini requests.

