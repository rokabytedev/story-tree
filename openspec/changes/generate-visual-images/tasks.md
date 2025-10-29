# generate-visual-images Tasks

## Progress Checklist

- [x] Batch 1: Foundation - Gemini Image Client & File Storage (4 tasks)
  - [x] Task 1.1: Implement name normalization utility
  - [x] Task 1.2: Implement image storage helper
  - [x] Task 1.3: Implement Gemini image generation client
  - [x] Task 1.4: Add image path storage helpers
- [ ] Batch 2: Visual Reference Image Generation Task (3 tasks)
  - [ ] Task 2.1: Create visual reference image task implementation
  - [ ] Task 2.2: Integrate CREATE_VISUAL_REFERENCE_IMAGES into workflow
  - [ ] Task 2.3: Add visual reference image task to CLI
- [ ] Batch 3: Shot Image Generation Task & Database Migration (6 tasks)
  - [ ] Task 3.1: Add image_path columns to shots table
  - [ ] Task 3.2: Update shots repository with image path methods
  - [ ] Task 3.3: Create shot image task implementation
  - [ ] Task 3.4: Create system prompt for visual renderer
  - [ ] Task 3.5: Integrate CREATE_SHOT_IMAGES into workflow
  - [ ] Task 3.6: Add shot image task to CLI
- [ ] Batch 4: Individual Image Generation & CLI Enhancements (2 tasks)
  - [ ] Task 4.1: Add individual visual reference image generation support
  - [ ] Task 4.2: Add individual shot image generation support
- [ ] Batch 5: Integration Testing & Documentation (4 tasks)
  - [ ] Task 5.1: Add integration tests with fixtures
  - [ ] Task 5.2: Update .gitignore for generated images
  - [ ] Task 5.3: Document image generation architecture
  - [ ] Task 5.4: Update supabase README with migration instructions
- [ ] Batch 6: Manual QA & Production Readiness (3 tasks)
  - [ ] Task 6.1: Manual QA with real Gemini API
  - [ ] Task 6.2: Add environment variable documentation
  - [ ] Task 6.3: Update GitHub Actions workflow for Supabase deployment
- [ ] Batch 7: Final Polish & Review (3 tasks)
  - [ ] Task 7.1: Add error handling telemetry
  - [ ] Task 7.2: Optimize reference image loading
  - [ ] Task 7.3: Final code review and cleanup

## Implementation Order

Tasks are grouped into logical batches with clear validation checkpoints. Each batch delivers user-visible progress and includes tests.

---

## Batch 1: Foundation - Gemini Image Client & File Storage

### Task 1.1: Implement name normalization utility
- **Description**: Create `normalizeNameForPath(name: string): string` utility function
- **Acceptance**:
  - Converts "Cosmo the Coder" → "cosmo-the-coder"
  - Handles Unicode, emoji, special chars safely
  - Throws on empty/whitespace-only names
  - Unit tests cover edge cases (see spec scenarios)
- **Files**: `agent-backend/src/image-generation/normalizeNameForPath.ts`, `agent-backend/test/normalizeNameForPath.test.ts`

### Task 1.2: Implement image storage helper
- **Description**: Create `ImageStorageService` with `saveImage(buffer, storyId, category, filename)` method
- **Acceptance**:
  - Creates `apps/story-tree-ui/public/generated/<story-id>/<category>/` directories
  - Writes buffer to file, returns relative path
  - Validates filenames, prevents path traversal
  - Unit tests use temp directories and verify writes
- **Files**: `agent-backend/src/image-generation/imageStorage.ts`, `agent-backend/test/imageStorage.test.ts`
- **Dependencies**: Task 1.1 (uses name normalization)

### Task 1.3: Implement Gemini image generation client
- **Description**: Create `GeminiImageClient` with `generateImage(request)` method wrapping Gemini 2.5 Flash Image API
- **Acceptance**:
  - Accepts user prompt, optional system instruction, reference images (max 3), aspect ratio
  - Encodes reference images as base64 inline data
  - Decodes response base64 image to Buffer
  - Handles errors: rate limits (retry), timeouts, malformed responses
  - Unit tests mock transport, verify request/response mapping
- **Files**: `agent-backend/src/image-generation/geminiImageClient.ts`, `agent-backend/src/image-generation/types.ts`, `agent-backend/test/geminiImageClient.test.ts`
- **Dependencies**: None (reuses existing `@google/genai` SDK)

### Task 1.4: Add image path storage helpers
- **Description**: Create path builder utilities: `buildVisualReferencePath()`, `buildShotImagePath()`, `validateImagePath()`
- **Acceptance**:
  - `buildVisualReferencePath(storyId, category, name, index)` constructs visual reference paths
  - `buildShotImagePath(storyId, sceneletId, shotIndex, frameType)` constructs shot paths with frame type ("first_frame" or "key_frame")
  - Validates path safety (no `..`, absolute paths)
  - Unit tests verify all path combinations including both frame types
- **Files**: `agent-backend/src/storage/imagePathHelpers.ts`, `agent-backend/test/imagePathHelpers.test.ts`
- **Dependencies**: Task 1.1 (uses name normalization)

**Batch 1 Validation**: Run `npm test` and verify all image generation foundation tests pass.

---

## Batch 2: Visual Reference Image Generation Task

### Task 2.1: Create visual reference image task implementation
- **Description**: Implement `runVisualReferenceImageTask(storyId, dependencies)` in `visual-reference-image/` module
- **Acceptance**:
  - Loads `visual_reference_package` from stories repository
  - Iterates character model sheets and environment keyframes
  - Calls Gemini image client for each missing `image_path`
  - Saves images via image storage helper
  - Updates package JSON with image paths
  - Persists updated package to stories repository
  - Skips entries with existing `image_path` (resume mode)
  - Unit tests inject fake dependencies, verify call sequences
- **Files**: `agent-backend/src/visual-reference-image/task.ts`, `agent-backend/src/visual-reference-image/types.ts`, `agent-backend/test/visualReferenceImageTask.test.ts`
- **Dependencies**: Tasks 1.2, 1.3, 1.4

### Task 2.2: Integrate CREATE_VISUAL_REFERENCE_IMAGES into workflow
- **Description**: Add new task to `StoryWorkflowTask` enum and `storyWorkflow.ts` orchestrator
- **Acceptance**:
  - `runTask('CREATE_VISUAL_REFERENCE_IMAGES')` validates prerequisites (package exists)
  - `runAllTasks()` executes task after `CREATE_VISUAL_REFERENCE`
  - Skips if all images already generated
  - Unit tests verify task ordering and prerequisite checks
- **Files**: `agent-backend/src/workflow/types.ts`, `agent-backend/src/workflow/storyWorkflow.ts`, `agent-backend/test/storyWorkflow.test.ts`
- **Dependencies**: Task 2.1

### Task 2.3: Add visual reference image task to CLI
- **Description**: Extend `agentWorkflowCli.ts` to support `CREATE_VISUAL_REFERENCE_IMAGES` task
- **Acceptance**:
  - `run-task --task CREATE_VISUAL_REFERENCE_IMAGES` works in stub and real modes
  - `run-all` includes the new task in pipeline
  - Stub mode uses fake image data (small PNG buffer)
  - CLI prints success message with generated image count
- **Files**: `agent-backend/src/cli/agentWorkflowCli.ts`, `agent-backend/test/agentWorkflowCli.test.ts`
- **Dependencies**: Task 2.2

**Batch 2 Validation**: Run CLI in stub mode: `npm run agent-workflow:cli -- run-task --task CREATE_VISUAL_REFERENCE_IMAGES --story-id <test-story> --mode stub`. Verify images created in `public/generated/`.

---

## Batch 3: Shot Image Generation Task & Database Migration

### Task 3.1: Add image_path columns to shots table
- **Description**: Create Supabase migration adding `first_frame_image_path` and `key_frame_image_path` TEXT columns to `public.shots`
- **Acceptance**:
  - Migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_shots_image_paths.sql`
  - Both columns are nullable, no default values
  - Apply locally: `supabase db push`
  - Verify schema with `psql` or Supabase Studio
- **Files**: `supabase/migrations/000XXX_add_shots_image_paths.sql`
- **Dependencies**: None

### Task 3.2: Update shots repository with image path methods
- **Description**: Add `updateShotImagePaths()` and `findShotsMissingImages()` methods to shots repository
- **Acceptance**:
  - `updateShotImagePaths(storyId, sceneletId, shotIndex, paths)` sets `first_frame_image_path` and/or `key_frame_image_path` columns
  - Supports updating one or both paths (for resume mode)
  - `findShotsMissingImages(storyId)` returns shots where either path IS NULL
  - TypeScript types include `firstFrameImagePath?: string` and `keyFrameImagePath?: string` fields
  - Unit tests verify updates and queries for both columns
- **Files**: `supabase/src/shotsRepository.ts`, `supabase/test/shotsRepository.test.ts`
- **Dependencies**: Task 3.1

### Task 3.3: Create shot image task implementation
- **Description**: Implement `runShotImageTask(storyId, dependencies)` in `shot-image/` module
- **Acceptance**:
  - Loads shots via shots repository (missing images only in resume mode)
  - Loads `visual_reference_package` for character reference lookup
  - Extracts character names from shot `storyboard_payload`
  - Loads character reference images from filesystem (max 3, prioritize model sheets)
  - Generates TWO images per shot:
    - First frame: Uses `first_frame_prompt`, saves to `*_first_frame.png`, updates `first_frame_image_path`
    - Key frame: Uses `key_frame_prompt`, saves to `*_key_frame.png`, updates `key_frame_image_path`
  - Both images use same character reference images for consistency
  - Supports resume mode: only generates missing images (first, key, or both)
  - Fails fast if character references missing or not found
  - Unit tests mock all dependencies and verify both images generated
- **Files**: `agent-backend/src/shot-image/task.ts`, `agent-backend/src/shot-image/types.ts`, `agent-backend/src/shot-image/referenceImageLoader.ts`, `agent-backend/test/shotImageTask.test.ts`, `agent-backend/test/referenceImageLoader.test.ts`
- **Dependencies**: Tasks 1.2, 1.3, 1.4, 3.2

### Task 3.4: Create system prompt for visual renderer
- **Description**: Create `system_prompts/visual_renderer.md` with instructions for shot image generation consistency
- **Acceptance**:
  - Prompt guides model to use reference images for character likeness
  - Emphasizes maintaining visual style from references
  - Instructs on composition, lighting, and shot framing
  - Keep under 500 words for efficient token usage
- **Files**: `system_prompts/visual_renderer.md`
- **Dependencies**: None

### Task 3.5: Integrate CREATE_SHOT_IMAGES into workflow
- **Description**: Add `CREATE_SHOT_IMAGES` task to workflow orchestrator
- **Acceptance**:
  - `runTask('CREATE_SHOT_IMAGES')` validates prerequisites (shots exist, visual reference images exist)
  - `runAllTasks()` executes task after `CREATE_SHOT_PRODUCTION`
  - Skips if all shots already have images
  - Unit tests verify task integration
- **Files**: `agent-backend/src/workflow/types.ts`, `agent-backend/src/workflow/storyWorkflow.ts`, `agent-backend/test/storyWorkflow.test.ts`
- **Dependencies**: Tasks 3.3, 3.4

### Task 3.6: Add shot image task to CLI
- **Description**: Extend CLI to support `CREATE_SHOT_IMAGES` task
- **Acceptance**:
  - `run-task --task CREATE_SHOT_IMAGES` works in stub and real modes
  - `run-all` includes the new task after shot production
  - Stub mode uses fake image data and skips actual file reads
  - CLI prints success with generated shot count (including both first frame and key frame counts)
- **Files**: `agent-backend/src/cli/agentWorkflowCli.ts`, `agent-backend/test/agentWorkflowCli.test.ts`
- **Dependencies**: Task 3.5

**Batch 3 Validation**: Run CLI in stub mode: `npm run agent-workflow:cli -- run-task --task CREATE_SHOT_IMAGES --story-id <test-story> --mode stub`. Verify TWO images per shot created in `public/generated/<story-id>/shots/` (*_first_frame.png and *_key_frame.png).

---

## Batch 4: Individual Image Generation & CLI Enhancements

### Task 4.1: Add individual visual reference image generation support
- **Description**: Extend visual reference image task to support generating single image by character/environment name and index
- **Acceptance**:
  - Task accepts optional `targetCharacterName`, `targetEnvironmentName`, `targetIndex` parameters
  - When provided, generates only the specified image
  - Validates target exists in visual reference package
  - CLI supports `--character-name` and `--environment-name` flags
- **Files**: `agent-backend/src/visual-reference-image/task.ts`, `agent-backend/src/cli/agentWorkflowCli.ts`, tests
- **Dependencies**: Task 2.3

### Task 4.2: Add individual shot image generation support
- **Description**: Extend shot image task to support generating single shot by scenelet ID and shot index
- **Acceptance**:
  - Task accepts optional `targetSceneletId`, `targetShotIndex` parameters
  - When provided, generates only the specified shot image
  - Validates shot exists before calling Gemini
  - CLI supports `--scenelet-id` and `--shot-index` flags
- **Files**: `agent-backend/src/shot-image/task.ts`, `agent-backend/src/cli/agentWorkflowCli.ts`, tests
- **Dependencies**: Task 3.6

**Batch 4 Validation**: Run CLI with individual flags: `npm run agent-workflow:cli -- run-task --task CREATE_SHOT_IMAGES --story-id <test-story> --scenelet-id scenelet-1 --shot-index 1 --mode real`. Verify only one image generated.

---

## Batch 5: Integration Testing & Documentation

### Task 5.1: Add integration tests with fixtures
- **Description**: Create end-to-end tests using Supabase test database and stub Gemini client
- **Acceptance**:
  - Test `CREATE_VISUAL_REFERENCE_IMAGES` task with fixture visual reference package
  - Test `CREATE_SHOT_IMAGES` task with fixture shots and visual references
  - Test resume mode (partial completion, rerun completes remainder)
  - Verify filesystem paths and database updates
- **Files**: `agent-backend/test/visualReferenceImageIntegration.test.ts`, `agent-backend/test/shotImageIntegration.test.ts`
- **Dependencies**: Tasks 2.3, 3.6

### Task 5.2: Update .gitignore for generated images
- **Description**: Add `apps/story-tree-ui/public/generated/` to `.gitignore`
- **Acceptance**:
  - Generated images not committed to git
  - Pattern covers all story subdirectories
- **Files**: `.gitignore`
- **Dependencies**: None

### Task 5.3: Document image generation architecture
- **Description**: Add README to `agent-backend/src/image-generation/` explaining architecture and usage
- **Acceptance**:
  - Documents Gemini image client usage
  - Explains file storage conventions
  - Provides examples of task invocation
  - Links to design doc for deeper details
- **Files**: `agent-backend/src/image-generation/README.md`
- **Dependencies**: Tasks 1.3, 1.2

### Task 5.4: Update supabase README with migration instructions
- **Description**: Document new `shots.image_path` column in Supabase README
- **Acceptance**:
  - README explains purpose of image_path column
  - Includes migration command: `supabase db push`
  - Notes that column is nullable (images generated after shots)
- **Files**: `supabase/README.md`
- **Dependencies**: Task 3.1

**Batch 5 Validation**: Run full integration test suite: `npm test agent-backend/test/*Integration.test.ts`. All tests pass.

---

## Batch 6: Manual QA & Production Readiness

### Task 6.1: Manual QA with real Gemini API
- **Description**: Run full workflow against real Gemini 2.5 Flash Image API with small story
- **Acceptance**:
  - Generate constitution, interactive script, visual design, visual reference
  - Run `CREATE_VISUAL_REFERENCE_IMAGES` task, inspect generated images for quality
  - Generate audio design, shot production
  - Run `CREATE_SHOT_IMAGES` task, verify character consistency using reference images
  - Validate images display correctly in browser via Next.js static serving (`http://localhost:3000/generated/<story-id>/...`)
- **Validation**: Document any prompt adjustments needed in `system_prompts/visual_renderer.md`

### Task 6.2: Add environment variable documentation
- **Description**: Document new environment variables in root README or `.env.example`
- **Acceptance**:
  - Document `GEMINI_IMAGE_MODEL` (default: gemini-2.5-flash-image)
  - Document `GEMINI_IMAGE_TIMEOUT_MS` (default: 60000)
  - Optional: `VISUAL_REFERENCE_ASPECT_RATIO`, `SHOT_IMAGE_ASPECT_RATIO`
- **Files**: `README.md` or `.env.example`
- **Dependencies**: None

### Task 6.3: Update GitHub Actions workflow for Supabase deployment
- **Description**: Ensure existing Supabase deployment workflow includes new migration
- **Acceptance**:
  - Verify `.github/workflows/deploy-supabase.yml` runs `supabase db push`
  - Test workflow triggers correctly on merge to main
  - Confirm migration applies cleanly to production Supabase instance
- **Files**: `.github/workflows/deploy-supabase.yml` (if exists)
- **Dependencies**: Task 3.1

**Batch 6 Validation**: Complete manual QA checklist. All images generate successfully and display in UI.

---

## Batch 7: Final Polish & Review

### Task 7.1: Add error handling telemetry
- **Description**: Ensure all image generation errors are logged with context (story ID, task, character/shot)
- **Acceptance**:
  - Gemini API errors logged with rate limit/timeout details
  - File system errors (permissions, disk space) logged clearly
  - Character reference lookup failures logged with missing name
- **Files**: All task implementation files
- **Dependencies**: Tasks 2.1, 3.3

### Task 7.2: Optimize reference image loading
- **Description**: Implement efficient reference image caching to avoid redundant filesystem reads
- **Acceptance**:
  - Reference image loader caches loaded images in-memory during task execution
  - Reduces filesystem I/O for shots referencing same characters
  - Unit tests verify cache behavior
- **Files**: `agent-backend/src/shot-image/referenceImageLoader.ts`, tests
- **Dependencies**: Task 3.3

### Task 7.3: Final code review and cleanup
- **Description**: Review all new code for consistency, test coverage, and documentation
- **Acceptance**:
  - All files follow existing TypeScript/ESLint conventions
  - Test coverage ≥ 90% for new modules (measured via vitest coverage)
  - No console.log statements (use proper logging)
  - All TODOs resolved or tracked in issues
- **Validation**: Run `npm run typecheck` and `npm test` with no errors

**Batch 7 Validation**: Run full test suite, manual QA, and deploy to staging environment for final verification.

---

## Summary

- **Batch 1**: Foundation (4 tasks) - Image client, storage, helpers
- **Batch 2**: Visual reference images (3 tasks) - Task, workflow, CLI
- **Batch 3**: Shot images (6 tasks) - Migration, repository, task, workflow, CLI
- **Batch 4**: Individual generation (2 tasks) - CLI flags for single images
- **Batch 5**: Integration & docs (4 tasks) - Tests, gitignore, READMEs
- **Batch 6**: Production readiness (3 tasks) - Manual QA, env docs, CI/CD
- **Batch 7**: Polish (3 tasks) - Telemetry, optimization, review

**Total**: 25 tasks across 7 logical batches

**Dependencies**: Linear progression through batches recommended; tasks within batches can be parallelized where dependencies allow.
