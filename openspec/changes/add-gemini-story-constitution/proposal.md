# Add Gemini API Integration for Story Constitution Generation

## Why

The interactive storybook project requires an AI-powered creative director to transform user story ideas into comprehensive creative outlines (Story Constitutions). These constitutions serve as foundational blueprints for the entire agentic workflow that produces interactive animated storybooks. Currently, there is no automated mechanism to generate these structured documents from user input.

## What Changes

- Add a TypeScript function that integrates with Google's Gemini API to generate Story Constitutions
- Read the system prompt from `system_prompts/story_constitution.md` for consistent creative direction
- Parse Gemini's JSON response containing `proposed_story_title` and `story_constitution_markdown`
- Accept user story descriptions as input and return structured Story Constitution objects
- Configure API key management via environment variables
- Implement comprehensive error handling including:
  - API rate limit and resource limit errors (with distinct error types for retry logic)
  - JSON parsing errors
  - File I/O operations errors
  - Network timeouts (configured for long-running Gemini responses, up to several minutes)
- Add input validation for story descriptions (length and content checks)
- Create a dedicated `src/services/` directory to house API integration and business logic
- Define TypeScript interfaces for request/response types and custom error classes

## Impact

- **New capability**: `story-constitution-generation` - First component in the agentic workflow
- **New code**:
  - `src/services/storyConstitution.ts` - Main API integration function
  - `src/types/storyConstitution.ts` - TypeScript interfaces and type definitions
  - `src/errors/StoryConstitutionError.ts` - Custom error classes including rate limit errors
  - `tsconfig.json` - TypeScript configuration (if not already present)
  - Will require `.env` file setup for `GOOGLE_API_KEY`
- **Dependencies**:
  - Already installed: `@google/genai` (v1.27.0)
  - May need: `typescript`, `@types/node`, `dotenv`
- **Downstream**: This function will be consumed by higher-level orchestration code in the agentic workflow
- **No breaking changes**: This is a greenfield addition to support a new feature

## Related Work

- Depends on existing `system_prompts/story_constitution.md` (already present)
- Foundation for future agentic workflow components (scriptwriter, storyboard artist, etc.)
