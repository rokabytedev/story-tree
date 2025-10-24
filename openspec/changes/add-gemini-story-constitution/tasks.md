# Implementation Tasks

## 1. Project Setup

- [ ] 1.1 Create directory structure
  - [ ] 1.1.1 Create `src/services/` directory
  - [ ] 1.1.2 Create `src/types/` directory
  - [ ] 1.1.3 Create `src/errors/` directory
- [ ] 1.2 Configure TypeScript
  - [ ] 1.2.1 Create or verify `tsconfig.json` exists with proper configuration
  - [ ] 1.2.2 Ensure target is ES2020 or higher
  - [ ] 1.2.3 Enable strict mode and necessary compiler options
- [ ] 1.3 Install dependencies
  - [ ] 1.3.1 Install `typescript` (if not present)
  - [ ] 1.3.2 Install `@types/node` for Node.js type definitions
  - [ ] 1.3.3 Install `dotenv` for environment variable loading
- [ ] 1.4 Create `.env.example` file with `GOOGLE_API_KEY=your_api_key_here` template
- [ ] 1.5 Add `.env` to `.gitignore` if not already present

## 2. Type Definitions

- [ ] 2.1 Create `src/types/storyConstitution.ts`
  - [ ] 2.1.1 Define `StoryConstitutionInput` interface (description, optional timeout)
  - [ ] 2.1.2 Define `StoryConstitutionResponse` interface (proposed_story_title, story_constitution_markdown)
  - [ ] 2.1.3 Define `GenerationConfig` interface for Gemini API configuration
  - [ ] 2.1.4 Export all type definitions

## 3. Custom Error Classes

- [ ] 3.1 Create `src/errors/StoryConstitutionError.ts`
  - [ ] 3.1.1 Implement base `StoryConstitutionError` class extending Error
  - [ ] 3.1.2 Implement `ValidationError` for input validation failures
  - [ ] 3.1.3 Implement `RateLimitError` with retry-after information
  - [ ] 3.1.4 Implement `ResourceLimitError` with limit details
  - [ ] 3.1.5 Implement `FileSystemError` for system prompt reading issues
  - [ ] 3.1.6 Implement `APIError` for general API failures
  - [ ] 3.1.7 Implement `TimeoutError` for request timeouts
  - [ ] 3.1.8 Implement `JSONParseError` for response parsing failures
  - [ ] 3.1.9 Export all error classes

## 4. Core Function Implementation

- [ ] 4.1 Create `src/services/storyConstitution.ts` file
- [ ] 4.2 Import required dependencies (@google/genai, fs/promises, path, dotenv)
- [ ] 4.3 Import type definitions and error classes
- [ ] 4.4 Implement input validation function
  - [ ] 4.4.1 Check for empty/whitespace-only descriptions (throw ValidationError)
  - [ ] 4.4.2 Check for excessive length (>5000 characters, throw ValidationError)
  - [ ] 4.4.3 Add TypeScript parameter and return types
- [ ] 4.5 Implement system prompt loading function
  - [ ] 4.5.1 Use async fs.readFile to read from `system_prompts/story_constitution.md`
  - [ ] 4.5.2 Handle file read errors (throw FileSystemError)
  - [ ] 4.5.3 Add TypeScript return type annotation
  - [ ] 4.5.4 Optionally cache the prompt to avoid repeated file reads
- [ ] 4.6 Implement main `generateStoryConstitution` async function
  - [ ] 4.6.1 Add strongly-typed function signature with input/output types
  - [ ] 4.6.2 Validate API key from environment (throw error if missing)
  - [ ] 4.6.3 Initialize Gemini client with type safety
  - [ ] 4.6.4 Configure model with generation parameters and JSON response mode
  - [ ] 4.6.5 Set timeout to 5 minutes (300000ms) or use provided timeout value
  - [ ] 4.6.6 Call Gemini API with system prompt and user description
  - [ ] 4.6.7 Detect and handle rate limit errors (429 status, throw RateLimitError)
  - [ ] 4.6.8 Detect and handle resource limit errors (quota, throw ResourceLimitError)
  - [ ] 4.6.9 Parse JSON response (throw JSONParseError on failure)
  - [ ] 4.6.10 Validate response structure against TypeScript interface
  - [ ] 4.6.11 Return typed StoryConstitutionResponse object

## 5. Error Handling and Timeout Configuration

- [ ] 5.1 Add try-catch blocks for API calls with specific error type detection
- [ ] 5.2 Implement error response parsing from Gemini API
  - [ ] 5.2.1 Detect 429 status codes and rate limit messages
  - [ ] 5.2.2 Extract retry-after headers when available
  - [ ] 5.2.3 Detect resource/quota limit errors
  - [ ] 5.2.4 Map API errors to appropriate custom error types
- [ ] 5.3 Configure timeout handling
  - [ ] 5.3.1 Set default timeout to 300000ms (5 minutes)
  - [ ] 5.3.2 Allow timeout to be configured via function parameter
  - [ ] 5.3.3 Implement proper timeout error handling (throw TimeoutError)
- [ ] 5.4 Add type guards for error handling
  - [ ] 5.4.1 Create type guard functions (isRateLimitError, isResourceLimitError, etc.)
  - [ ] 5.4.2 Export type guards for consumer use

## 6. Documentation

- [ ] 6.1 Add TSDoc comments to all exported functions and types
- [ ] 6.2 Document function parameters with TypeScript types and JSDoc descriptions
- [ ] 6.3 Add usage examples showing TypeScript usage patterns
- [ ] 6.4 Document error handling with examples of catching specific error types
- [ ] 6.5 Create README section explaining:
  - [ ] 6.5.1 Setup instructions (environment variables, dependencies)
  - [ ] 6.5.2 Basic usage with TypeScript code example
  - [ ] 6.5.3 Error handling patterns with retry logic for rate limits
  - [ ] 6.5.4 Timeout configuration options

## 7. Testing and Validation

- [ ] 7.1 Create TypeScript test script in `src/test/storyConstitution.test.ts`
- [ ] 7.2 Test successful story constitution generation
  - [ ] 7.2.1 Test with sample story descriptions
  - [ ] 7.2.2 Verify response type matches StoryConstitutionResponse interface
  - [ ] 7.2.3 Validate both fields are non-empty strings
- [ ] 7.3 Test error scenarios
  - [ ] 7.3.1 Test with missing API key
  - [ ] 7.3.2 Test with empty/whitespace input (expect ValidationError)
  - [ ] 7.3.3 Test with excessively long input (expect ValidationError)
  - [ ] 7.3.4 Test error type detection with TypeScript type guards
- [ ] 7.4 Test timeout configuration
  - [ ] 7.4.1 Verify default 5-minute timeout is applied
  - [ ] 7.4.2 Test with custom timeout value
- [ ] 7.5 Compile TypeScript to verify no type errors
- [ ] 7.6 Test with actual `system_prompts/story_constitution.md` content

## 8. Build and Integration Preparation

- [ ] 8.1 Configure build output
  - [ ] 8.1.1 Set up TypeScript compilation output directory
  - [ ] 8.1.2 Add build script to package.json
- [ ] 8.2 Export all public APIs from main module
  - [ ] 8.2.1 Export main function from src/services/storyConstitution.ts
  - [ ] 8.2.2 Export types from src/types/storyConstitution.ts
  - [ ] 8.2.3 Export error classes from src/errors/StoryConstitutionError.ts
  - [ ] 8.2.4 Create barrel export file (src/index.ts) if needed
- [ ] 8.3 Document TypeScript integration for consumers
  - [ ] 8.3.1 Show import examples with types
  - [ ] 8.3.2 Provide retry logic example for RateLimitError
  - [ ] 8.3.3 Document timeout customization pattern
