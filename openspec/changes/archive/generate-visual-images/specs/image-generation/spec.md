# image-generation Specification Delta

## ADDED Requirements

### Requirement: Provide Gemini Image Generation Client
The backend MUST expose a Gemini client wrapper that generates images from text prompts with optional reference images and returns binary image data.

#### Scenario: Client generates image from text prompt
- **GIVEN** a user provides a text prompt describing the desired image
- **WHEN** the Gemini image client `generateImage` method is called with the prompt
- **THEN** it MUST invoke the Gemini 2.5 Flash Image API (`gemini-2.5-flash-image` model)
- **AND** it MUST return an `ImageGenerationResult` containing the image as a Buffer with MIME type
- **AND** it MUST support configurable aspect ratios (1:1, 16:9, 9:16, 3:4, 4:3, 2:3, 3:2, 4:5, 5:4, 21:9)
- **AND** it MUST apply a default timeout of 60 seconds unless overridden via `timeoutMs` option.

#### Scenario: Client supports system instructions for shot consistency
- **GIVEN** a shot image generation request with a system instruction
- **WHEN** the client calls Gemini
- **THEN** it MUST include the system instruction in the API request config
- **AND** it MUST combine the system instruction with the user prompt to guide image generation
- **AND** tests MUST verify system instruction is passed through correctly.

#### Scenario: Client uploads reference images for character consistency
- **GIVEN** a shot image generation request with 1-3 reference images
- **WHEN** the client prepares the Gemini request
- **THEN** it MUST encode each reference image as base64 inline data with correct MIME type
- **AND** it MUST include reference images in the `contents` array before the text prompt
- **AND** it MUST reject requests with more than 3 reference images with a descriptive error
- **AND** it MUST validate that each reference image has a supported MIME type (`image/png` or `image/jpeg`).

#### Scenario: Client handles Gemini API errors with retry
- **GIVEN** Gemini returns a rate limit error (429 or RESOURCE_EXHAUSTED)
- **WHEN** the client receives the error
- **THEN** it MUST throw a `GeminiRateLimitError` with retry-after metadata
- **AND** it MUST leverage the existing `executeGeminiWithRetry` infrastructure
- **AND** it MUST surface timeout and non-retryable errors as `GeminiApiError` with descriptive messages.

#### Scenario: Client decodes generated image from response
- **GIVEN** Gemini returns a successful response with inline image data
- **WHEN** the client processes the response
- **THEN** it MUST extract the base64-encoded image from `candidates[0].content.parts[0].inlineData`
- **AND** it MUST decode the base64 data to a Buffer
- **AND** it MUST extract the MIME type from `inlineData.mimeType`
- **AND** it MUST throw an error if the response contains no image data or is malformed.

### Requirement: Persist Generated Images to File System
The backend MUST provide a storage helper that saves image buffers to the Next.js public directory with predictable paths.

#### Scenario: Storage helper saves image to story-specific directory
- **GIVEN** an image buffer, story ID, category (visuals/shots), and filename
- **WHEN** the storage helper `saveImage` method is called
- **THEN** it MUST create the directory `apps/story-tree-ui/public/generated/<story-id>/<category>/` if it doesn't exist
- **AND** it MUST write the buffer to `<directory>/<filename>`
- **AND** it MUST return the relative path from `public/generated/` root (e.g., `<story-id>/shots/scenelet-1_shot_1.png`)
- **AND** it MUST overwrite existing files with the same name without error.

#### Scenario: Storage helper sanitizes filenames
- **GIVEN** a filename containing path traversal characters (`..`, `/`, `\`)
- **WHEN** the storage helper validates the filename
- **THEN** it MUST reject the filename with a descriptive error
- **AND** it MUST prevent writing files outside the intended directory
- **AND** tests MUST cover edge cases like empty filenames, special characters, and excessively long names.

#### Scenario: Storage helper validates write permissions
- **GIVEN** the storage helper is invoked for the first time
- **WHEN** it attempts to create the target directory
- **THEN** it MUST catch EACCES or ENOSPC errors
- **AND** it MUST throw a descriptive error indicating filesystem permission or space issues
- **AND** it MUST avoid silent failures.

### Requirement: Normalize Names for File Paths
The backend MUST provide a utility that converts character and environment names into filesystem-safe path segments.

#### Scenario: Normalizer converts names to lowercase kebab-case
- **GIVEN** a character name like "Cosmo the Coder"
- **WHEN** the name normalizer is called
- **THEN** it MUST return `cosmo-the-coder` (lowercase, spaces to hyphens)
- **AND** it MUST remove or replace special characters (e.g., `!`, `@`, `#`) with hyphens
- **AND** it MUST collapse consecutive hyphens to a single hyphen
- **AND** it MUST trim leading and trailing hyphens.

#### Scenario: Normalizer handles edge cases
- **GIVEN** a name with Unicode characters, emoji, or excessive whitespace
- **WHEN** the normalizer processes it
- **THEN** it MUST produce a valid, filesystem-safe path segment
- **AND** it MUST throw an error for empty or whitespace-only names
- **AND** tests MUST cover names like "  Dr. O'Reilly ✨ ", "环境-1", and "Character/Name".
