# Story Constitution Generation

## ADDED Requirements

### Requirement: Gemini API Integration

The system SHALL provide a function that calls the Google Gemini API to generate Story Constitutions from user story descriptions.

#### Scenario: Successful story constitution generation

- **GIVEN** a user provides a story description "A young clownfish gets lost and must find his way home"
- **AND** the GOOGLE_API_KEY environment variable is set
- **WHEN** the function is called with the description
- **THEN** the Gemini API is invoked with the system prompt from `system_prompts/story_constitution.md`
- **AND** the function returns a parsed JSON object containing `proposed_story_title` and `story_constitution_markdown` fields

#### Scenario: Missing API key

- **GIVEN** the GOOGLE_API_KEY environment variable is not set
- **WHEN** the function is called
- **THEN** the function throws an error indicating the API key is missing

#### Scenario: Invalid JSON response from Gemini

- **GIVEN** Gemini returns a malformed JSON response
- **WHEN** the function attempts to parse the response
- **THEN** the function throws an error indicating JSON parsing failure

#### Scenario: API request failure

- **GIVEN** the Gemini API is unavailable or returns an error
- **WHEN** the function makes an API call
- **THEN** the function propagates the API error with a clear error message

### Requirement: System Prompt Loading

The system SHALL read the creative director system prompt from the file system to ensure consistent Story Constitution generation.

#### Scenario: System prompt file exists

- **GIVEN** the file `system_prompts/story_constitution.md` exists
- **WHEN** the function is initialized or called
- **THEN** the system prompt content is read from the file
- **AND** the prompt is used as the system instruction for the Gemini API call

#### Scenario: System prompt file missing

- **GIVEN** the file `system_prompts/story_constitution.md` does not exist
- **WHEN** the function attempts to read the prompt
- **THEN** the function throws an error indicating the system prompt file is missing

### Requirement: Input Validation

The system SHALL validate user story descriptions before sending them to the Gemini API to ensure meaningful input.

#### Scenario: Valid story description

- **GIVEN** a user provides a non-empty story description with meaningful content
- **WHEN** the function validates the input
- **THEN** validation passes and the API call proceeds

#### Scenario: Empty story description

- **GIVEN** a user provides an empty string or whitespace-only description
- **WHEN** the function validates the input
- **THEN** the function throws an error indicating the description is empty

#### Scenario: Excessively long description

- **GIVEN** a user provides a story description longer than 5000 characters
- **WHEN** the function validates the input
- **THEN** the function throws an error indicating the description is too long

### Requirement: Response Structure

The system SHALL return Story Constitution data in a structured format that downstream components can consume.

#### Scenario: Response object structure

- **GIVEN** the Gemini API returns valid JSON
- **WHEN** the function parses and returns the response
- **THEN** the returned object contains a `proposed_story_title` string field
- **AND** the returned object contains a `story_constitution_markdown` string field
- **AND** both fields contain non-empty values

### Requirement: Error Handling

The system SHALL provide clear error messages for all failure scenarios to aid debugging and user feedback, with distinct error types for different failure categories.

#### Scenario: File system error

- **GIVEN** the system prompt file cannot be read due to permissions or I/O error
- **WHEN** the function attempts to read the file
- **THEN** the function throws an error with the underlying file system error details

#### Scenario: Network timeout

- **GIVEN** the Gemini API request times out after the configured timeout period
- **WHEN** the function waits for a response
- **THEN** the function throws an error indicating a timeout occurred

#### Scenario: API rate limit exceeded

- **GIVEN** the Gemini API returns a rate limit error (429 status or quota exceeded)
- **WHEN** the function receives the error response
- **THEN** the function throws a distinct `RateLimitError` type
- **AND** the error includes retry-after information if available
- **AND** the caller can identify this error type to implement retry logic

#### Scenario: API resource limit exceeded

- **GIVEN** the Gemini API returns a resource limit error (quota exhausted, billing limit reached)
- **WHEN** the function receives the error response
- **THEN** the function throws a distinct `ResourceLimitError` type
- **AND** the error includes details about which limit was exceeded
- **AND** the caller can distinguish this from transient rate limits

### Requirement: Timeout Configuration

The system SHALL configure API timeouts to accommodate long-running Gemini API responses, including thinking mode and extensive content generation.

#### Scenario: Long-running generation with thinking mode

- **GIVEN** the Gemini API is processing a complex story constitution with thinking mode enabled
- **WHEN** the API takes several minutes to respond
- **THEN** the function waits for up to the configured timeout (minimum 5 minutes recommended)
- **AND** the function does not prematurely timeout for legitimate long-running operations

#### Scenario: Configurable timeout

- **GIVEN** different use cases may require different timeout values
- **WHEN** the function is configured or called
- **THEN** the timeout value can be specified (with a sensible default of 5 minutes)
- **AND** the timeout applies to the entire API request/response cycle

### Requirement: TypeScript Type Safety

The system SHALL be implemented in TypeScript with comprehensive type definitions for all inputs, outputs, and error types.

#### Scenario: Type-safe function signature

- **GIVEN** the function is implemented in TypeScript
- **WHEN** developers import and use the function
- **THEN** the function has a strongly-typed signature with input and return types
- **AND** the TypeScript compiler enforces type correctness at compile time

#### Scenario: Typed response objects

- **GIVEN** the function returns a Story Constitution object
- **WHEN** the response is used by consumers
- **THEN** the object type includes `proposed_story_title: string` and `story_constitution_markdown: string` properties
- **AND** TypeScript provides autocomplete and type checking for these properties

#### Scenario: Custom error type hierarchy

- **GIVEN** the function can throw multiple error types
- **WHEN** errors are caught and handled by consumers
- **THEN** error types include base `StoryConstitutionError` and specialized subtypes (`RateLimitError`, `ResourceLimitError`, `ValidationError`, etc.)
- **AND** consumers can use TypeScript type guards to handle different error types appropriately
