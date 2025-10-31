# Implementation Tasks: Environment Reference Image Generation

## Overview

This document breaks down the implementation into verifiable milestones. Each task delivers user-visible progress and includes validation steps.

---

## Milestone 1: Core Module Setup

### Task 1.1: Create environment-reference module structure
- [x] Create `agent-backend/src/environment-reference/` directory
- [x] Create placeholder files: `types.ts`, `errors.ts`, `promptBuilder.ts`, `environmentReferenceTask.ts`
- [x] Add index.ts with public exports
- [x] Verify: `npm run build` succeeds without errors

### Task 1.2: Define TypeScript types and interfaces
- [x] Define `EnvironmentReferenceTaskDependencies` interface in `types.ts`
  - Include: storiesRepository, imageClient, imageStorage, logger, verbose, timeoutMs, retry, targetEnvironmentId, override, resume
- [x] Define `EnvironmentReferenceTaskResult` interface
  - Include: generatedCount, skippedCount, errors array with environment_id and error message
- [x] Define `EnvironmentReferenceStoryRecord` interface
  - Extend AgentWorkflowStoryRecord with typed visualDesignDocument
- [x] Define `EnvironmentReferenceTaskRunner` function type
- [x] Define `EnvironmentReferenceImageStorage` interface
- [x] Verify: TypeScript compilation succeeds, exports are available

### Task 1.3: Implement error classes
- [x] Create `EnvironmentReferenceTaskError` class extending Error in `errors.ts`
- [x] Add constructor that accepts message and optional cause
- [x] Add environment context fields (environmentId, environmentName)
- [x] Verify: Can instantiate and throw error with context

---

## Milestone 2: Prompt Assembly Logic

### Task 2.1: Implement global aesthetic extraction
- [x] Create `extractGlobalAesthetic()` function in `promptBuilder.ts`
- [x] Extract `global_aesthetic` from visual_design_document
- [x] Handle missing or malformed global_aesthetic gracefully
- [x] Write unit test verifying correct extraction
- [x] Verify: Test passes, function returns expected object

### Task 2.2: Implement environment design extraction
- [x] Create `extractEnvironmentDesign()` function in `promptBuilder.ts`
- [x] Accept visualDesignDocument and environmentId parameters
- [x] Find environment design by environment_id field
- [x] Throw descriptive error if not found
- [x] Write unit test verifying lookup and error cases
- [x] Verify: Test passes, function returns correct environment design

### Task 2.3: Implement structured prompt builder
- [x] Create `buildEnvironmentReferencePrompt()` function in `promptBuilder.ts`
- [x] Use exact Role and Core Directive template from docs/019_visual_environment_plan.md lines 27-56
- [x] Append JSON block with global_aesthetic and environment_design
- [x] Ensure JSON is properly formatted and serialized
- [x] Write unit test with snapshot assertion to prevent regressions
- [x] Verify: Test passes, snapshot matches expected prompt format

### Task 2.4: Add visual design document parser
- [x] Create `parseVisualDesignDocument()` helper function
- [x] Validate document has required structure (global_aesthetic, environment_designs)
- [x] Return typed object or null if invalid
- [x] Write unit test with valid and invalid inputs
- [x] Verify: Test passes, handles edge cases correctly

---

## Milestone 3: Task Runner Implementation

### Task 3.1: Implement prerequisite validation
- [x] In `environmentReferenceTask.ts`, create `validatePrerequisites()` helper
- [x] Check story exists
- [x] Check visual_design_document exists and is valid
- [x] Check environment_designs array is non-empty
- [x] Throw EnvironmentReferenceTaskError with descriptive messages
- [x] Write unit tests for each validation case
- [x] Verify: Tests pass, validation prevents invalid execution

### Task 3.2: Implement batch mode environment selection logic
- [x] In `runEnvironmentReferenceTask()`, determine environments to process
- [x] If no targetEnvironmentId: process all environments (batch mode)
- [x] If targetEnvironmentId: find and process single environment
- [x] Validate targetEnvironmentId exists, throw error with available IDs if not
- [x] Write unit tests for batch and single mode selection
- [x] Verify: Tests pass, correct environments selected

### Task 3.3: Implement override and resume flag logic
- [x] Check if environment has existing environment_reference_image_path
- [x] If override=false and path exists: skip environment
- [x] If override=true: process environment regardless of existing path
- [x] If resume=true in batch mode: skip environments with existing paths
- [x] Log skipped environments in verbose mode
- [x] Write unit tests covering all flag combinations
- [x] Verify: Tests pass, skip logic works correctly

### Task 3.4: Implement image generation loop
- [x] Iterate through selected environments
- [x] For each environment: extract design, build prompt, call Gemini
- [x] Use aspectRatio: '16:9' hard-coded
- [x] Pass timeoutMs and retry options from dependencies
- [x] Catch and collect individual errors, continue processing
- [x] Log generation start/end in verbose mode
- [x] Write unit tests with mocked Gemini client
- [x] Verify: Tests pass, loop handles success and failure

### Task 3.5: Implement path construction and image storage
- [x] Build image path: `generated/<story-id>/visuals/environments/<environment-id>/environment-reference.png`
- [x] Call imageStorage.saveImage() with constructed path
- [x] Handle storage errors gracefully
- [x] Log saved path in verbose mode
- [x] Write unit tests with mocked storage service
- [x] Verify: Tests pass, paths constructed correctly

### Task 3.6: Implement immediate database persistence
- [x] After successful image save, update visual_design_document
- [x] Set environment_reference_image_path on the specific environment object
- [x] Call storiesRepository.updateStoryArtifacts immediately
- [x] Handle database errors, include generated path in error message
- [x] Write unit tests verifying immediate persistence per environment
- [x] Verify: Tests pass, database updated after each generation

### Task 3.7: Implement result summary and error reporting
- [x] Track counts: generatedCount, skippedCount
- [x] Collect errors array with environment_id and error message
- [x] Return EnvironmentReferenceTaskResult with summary
- [x] Write unit tests verifying correct counts and error collection
- [x] Verify: Tests pass, result summary accurate

---

## Milestone 4: Workflow Integration

### Task 4.1: Add CREATE_ENVIRONMENT_REFERENCE_IMAGE to workflow types
- [x] In `agent-backend/src/workflow/types.ts`, add task to StoryWorkflowTask union
- [x] Add `EnvironmentReferenceTaskOptions` interface
- [x] Add `environmentReferenceTaskOptions` and `runEnvironmentReferenceTask` to AgentWorkflowOptions
- [x] Verify: TypeScript compilation succeeds, exhaustive checks enforced

### Task 4.2: Implement workflow task handler
- [x] In `agent-backend/src/workflow/storyWorkflow.ts`, add case for CREATE_ENVIRONMENT_REFERENCE_IMAGE
- [x] Extract dependencies from workflow options
- [x] Call runEnvironmentReferenceTask with story ID and dependencies
- [x] Propagate errors with context
- [x] Write unit test verifying handler delegation
- [x] Verify: Test passes, workflow routes to task runner

### Task 4.3: Implement default task runner factory
- [x] Create factory function that instantiates dependencies (Gemini client, image storage)
- [x] Use environment variables for API keys
- [x] Follow pattern from character model sheet implementation
- [x] Export factory for use in CLI
- [x] Verify: Factory creates working task runner

---

## Milestone 5: CLI Integration

### Task 5.1: Add CLI command parsing
- [x] In `agent-backend/src/cli/agentWorkflowCli.ts`, recognize CREATE_ENVIRONMENT_REFERENCE_IMAGE
- [x] Parse `--environment-id <id>` flag
- [x] Parse `--override <true|false>` flag with default false
- [x] Parse `--resume` flag
- [x] Parse `--verbose` flag
- [x] Write tests verifying flag parsing
- [x] Verify: Tests pass, flags parsed correctly

### Task 5.2: Implement CLI flag validation
- [x] Validate that --resume is only used without --environment-id
- [x] Throw error with usage hint if invalid combination
- [x] Write tests for validation logic
- [x] Verify: Tests pass, invalid combinations rejected

### Task 5.3: Wire CLI to workflow task
- [x] Create AgentWorkflowOptions with environment reference task dependencies
- [x] Pass parsed flags to task options (targetEnvironmentId, override, resume, verbose)
- [x] Invoke workflow.runTask with CREATE_ENVIRONMENT_REFERENCE_IMAGE
- [x] Display result summary (generated, skipped, errors) to console
- [x] Write integration test invoking CLI command
- [x] Verify: Test passes, CLI executes task successfully

### Task 5.4: Update CLI help text
- [x] Add CREATE_ENVIRONMENT_REFERENCE_IMAGE to task list in help output
- [x] Document flags: --environment-id, --override, --resume, --verbose
- [x] Include usage examples for batch and single modes
- [x] Verify: Help text displays correctly

---

OPTIONAL BELOW DO NOT IMPLEMENT

## Milestone 6: Testing

### Task 6.1: Write unit tests for prompt builder
- [x] Test extractGlobalAesthetic with valid and missing data
- [x] Test extractEnvironmentDesign with valid ID, invalid ID
- [x] Test buildEnvironmentReferencePrompt with snapshot assertion
- [x] Verify prompt uses exact template from plan
- [x] Verify: All tests pass, coverage is adequate

### Task 6.2: Write unit tests for task runner
- [x] Test prerequisite validation (missing story, no visual design doc, no environments)
- [x] Test batch mode processes all environments
- [x] Test single mode processes one environment
- [x] Test override=false skips existing images
- [x] Test override=true regenerates existing images
- [x] Test resume flag skips environments with paths
- [x] Test error collection and partial batch success
- [x] Verify: All tests pass, edge cases covered

### Task 6.3: Write integration tests for end-to-end generation
- [x] Create test story with visual_design_document
- [x] Mock Gemini client to return test image data
- [x] Test batch generation saves all images and updates database
- [x] Test single mode targets correct environment
- [x] Test --override and --resume flags affect generation
- [x] Verify images saved to correct paths with 16:9 aspect ratio
- [x] Verify paths persisted in database immediately
- [x] Verify: All integration tests pass

### Task 6.4: Write CLI integration tests
- [x] Test CLI parses CREATE_ENVIRONMENT_REFERENCE_IMAGE command
- [x] Test CLI parses all flags correctly
- [x] Test CLI validates flag combinations
- [x] Test CLI displays result summary
- [x] Verify: CLI tests pass

---

## Milestone 7: Validation and Documentation

### Task 7.1: Run OpenSpec validation
- [x] Execute `openspec validate add-environment-reference-task --strict`
- [x] Resolve any validation errors
- [x] Verify: Validation passes without errors

### Task 7.2: Update agent-backend README
- [x] Add CREATE_ENVIRONMENT_REFERENCE_IMAGE to task list
- [x] Document batch and single mode usage
- [x] Document flags and their behavior
- [x] Include example commands
- [x] Verify: Documentation is clear and accurate

### Task 7.3: Manual end-to-end test
- [ ] Create test story with visual design document containing multiple environments
- [ ] Run CLI in batch mode: generate all environment reference images
- [ ] Verify images saved to correct file paths
- [ ] Verify database updated with image paths
- [ ] Verify images have 16:9 aspect ratio
- [ ] Test single mode with --environment-id
- [ ] Test --override=false skips existing images
- [ ] Test --override=true regenerates images
- [ ] Test --resume skips environments with existing paths
- [ ] Verify: All manual tests pass

---

## Notes

- **Dependencies Between Tasks**: Tasks within each milestone should be completed in order. Milestones can be parallelized where feasible (e.g., Milestone 2 and 3 are sequential, but Milestone 6 can start once core implementation is done).
- **Validation**: Each task includes a "Verify" step to ensure correctness before proceeding.
- **No Manual Verification Tasks**: All verification is done through automated tests or build checks.
