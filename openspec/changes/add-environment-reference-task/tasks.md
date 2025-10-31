# Implementation Tasks: Environment Reference Image Generation

## Overview

This document breaks down the implementation into verifiable milestones. Each task delivers user-visible progress and includes validation steps.

---

## Milestone 1: Core Module Setup

### Task 1.1: Create environment-reference module structure
- [ ] Create `agent-backend/src/environment-reference/` directory
- [ ] Create placeholder files: `types.ts`, `errors.ts`, `promptBuilder.ts`, `environmentReferenceTask.ts`
- [ ] Add index.ts with public exports
- [ ] Verify: `npm run build` succeeds without errors

### Task 1.2: Define TypeScript types and interfaces
- [ ] Define `EnvironmentReferenceTaskDependencies` interface in `types.ts`
  - Include: storiesRepository, imageClient, imageStorage, logger, verbose, timeoutMs, retry, targetEnvironmentId, override, resume
- [ ] Define `EnvironmentReferenceTaskResult` interface
  - Include: generatedCount, skippedCount, errors array with environment_id and error message
- [ ] Define `EnvironmentReferenceStoryRecord` interface
  - Extend AgentWorkflowStoryRecord with typed visualDesignDocument
- [ ] Define `EnvironmentReferenceTaskRunner` function type
- [ ] Define `EnvironmentReferenceImageStorage` interface
- [ ] Verify: TypeScript compilation succeeds, exports are available

### Task 1.3: Implement error classes
- [ ] Create `EnvironmentReferenceTaskError` class extending Error in `errors.ts`
- [ ] Add constructor that accepts message and optional cause
- [ ] Add environment context fields (environmentId, environmentName)
- [ ] Verify: Can instantiate and throw error with context

---

## Milestone 2: Prompt Assembly Logic

### Task 2.1: Implement global aesthetic extraction
- [ ] Create `extractGlobalAesthetic()` function in `promptBuilder.ts`
- [ ] Extract `global_aesthetic` from visual_design_document
- [ ] Handle missing or malformed global_aesthetic gracefully
- [ ] Write unit test verifying correct extraction
- [ ] Verify: Test passes, function returns expected object

### Task 2.2: Implement environment design extraction
- [ ] Create `extractEnvironmentDesign()` function in `promptBuilder.ts`
- [ ] Accept visualDesignDocument and environmentId parameters
- [ ] Find environment design by environment_id field
- [ ] Throw descriptive error if not found
- [ ] Write unit test verifying lookup and error cases
- [ ] Verify: Test passes, function returns correct environment design

### Task 2.3: Implement structured prompt builder
- [ ] Create `buildEnvironmentReferencePrompt()` function in `promptBuilder.ts`
- [ ] Use exact Role and Core Directive template from docs/019_visual_environment_plan.md lines 27-56
- [ ] Append JSON block with global_aesthetic and environment_design
- [ ] Ensure JSON is properly formatted and serialized
- [ ] Write unit test with snapshot assertion to prevent regressions
- [ ] Verify: Test passes, snapshot matches expected prompt format

### Task 2.4: Add visual design document parser
- [ ] Create `parseVisualDesignDocument()` helper function
- [ ] Validate document has required structure (global_aesthetic, environment_designs)
- [ ] Return typed object or null if invalid
- [ ] Write unit test with valid and invalid inputs
- [ ] Verify: Test passes, handles edge cases correctly

---

## Milestone 3: Task Runner Implementation

### Task 3.1: Implement prerequisite validation
- [ ] In `environmentReferenceTask.ts`, create `validatePrerequisites()` helper
- [ ] Check story exists
- [ ] Check visual_design_document exists and is valid
- [ ] Check environment_designs array is non-empty
- [ ] Throw EnvironmentReferenceTaskError with descriptive messages
- [ ] Write unit tests for each validation case
- [ ] Verify: Tests pass, validation prevents invalid execution

### Task 3.2: Implement batch mode environment selection logic
- [ ] In `runEnvironmentReferenceTask()`, determine environments to process
- [ ] If no targetEnvironmentId: process all environments (batch mode)
- [ ] If targetEnvironmentId: find and process single environment
- [ ] Validate targetEnvironmentId exists, throw error with available IDs if not
- [ ] Write unit tests for batch and single mode selection
- [ ] Verify: Tests pass, correct environments selected

### Task 3.3: Implement override and resume flag logic
- [ ] Check if environment has existing environment_reference_image_path
- [ ] If override=false and path exists: skip environment
- [ ] If override=true: process environment regardless of existing path
- [ ] If resume=true in batch mode: skip environments with existing paths
- [ ] Log skipped environments in verbose mode
- [ ] Write unit tests covering all flag combinations
- [ ] Verify: Tests pass, skip logic works correctly

### Task 3.4: Implement image generation loop
- [ ] Iterate through selected environments
- [ ] For each environment: extract design, build prompt, call Gemini
- [ ] Use aspectRatio: '16:9' hard-coded
- [ ] Pass timeoutMs and retry options from dependencies
- [ ] Catch and collect individual errors, continue processing
- [ ] Log generation start/end in verbose mode
- [ ] Write unit tests with mocked Gemini client
- [ ] Verify: Tests pass, loop handles success and failure

### Task 3.5: Implement path construction and image storage
- [ ] Build image path: `generated/<story-id>/visuals/environments/<environment-id>/environment-reference.png`
- [ ] Call imageStorage.saveImage() with constructed path
- [ ] Handle storage errors gracefully
- [ ] Log saved path in verbose mode
- [ ] Write unit tests with mocked storage service
- [ ] Verify: Tests pass, paths constructed correctly

### Task 3.6: Implement immediate database persistence
- [ ] After successful image save, update visual_design_document
- [ ] Set environment_reference_image_path on the specific environment object
- [ ] Call storiesRepository.updateStoryArtifacts immediately
- [ ] Handle database errors, include generated path in error message
- [ ] Write unit tests verifying immediate persistence per environment
- [ ] Verify: Tests pass, database updated after each generation

### Task 3.7: Implement result summary and error reporting
- [ ] Track counts: generatedCount, skippedCount
- [ ] Collect errors array with environment_id and error message
- [ ] Return EnvironmentReferenceTaskResult with summary
- [ ] Write unit tests verifying correct counts and error collection
- [ ] Verify: Tests pass, result summary accurate

---

## Milestone 4: Workflow Integration

### Task 4.1: Add CREATE_ENVIRONMENT_REFERENCE_IMAGE to workflow types
- [ ] In `agent-backend/src/workflow/types.ts`, add task to StoryWorkflowTask union
- [ ] Add `EnvironmentReferenceTaskOptions` interface
- [ ] Add `environmentReferenceTaskOptions` and `runEnvironmentReferenceTask` to AgentWorkflowOptions
- [ ] Verify: TypeScript compilation succeeds, exhaustive checks enforced

### Task 4.2: Implement workflow task handler
- [ ] In `agent-backend/src/workflow/storyWorkflow.ts`, add case for CREATE_ENVIRONMENT_REFERENCE_IMAGE
- [ ] Extract dependencies from workflow options
- [ ] Call runEnvironmentReferenceTask with story ID and dependencies
- [ ] Propagate errors with context
- [ ] Write unit test verifying handler delegation
- [ ] Verify: Test passes, workflow routes to task runner

### Task 4.3: Implement default task runner factory
- [ ] Create factory function that instantiates dependencies (Gemini client, image storage)
- [ ] Use environment variables for API keys
- [ ] Follow pattern from character model sheet implementation
- [ ] Export factory for use in CLI
- [ ] Verify: Factory creates working task runner

---

## Milestone 5: CLI Integration

### Task 5.1: Add CLI command parsing
- [ ] In `agent-backend/src/cli/agentWorkflowCli.ts`, recognize CREATE_ENVIRONMENT_REFERENCE_IMAGE
- [ ] Parse `--environment-id <id>` flag
- [ ] Parse `--override <true|false>` flag with default false
- [ ] Parse `--resume` flag
- [ ] Parse `--verbose` flag
- [ ] Write tests verifying flag parsing
- [ ] Verify: Tests pass, flags parsed correctly

### Task 5.2: Implement CLI flag validation
- [ ] Validate that --resume is only used without --environment-id
- [ ] Throw error with usage hint if invalid combination
- [ ] Write tests for validation logic
- [ ] Verify: Tests pass, invalid combinations rejected

### Task 5.3: Wire CLI to workflow task
- [ ] Create AgentWorkflowOptions with environment reference task dependencies
- [ ] Pass parsed flags to task options (targetEnvironmentId, override, resume, verbose)
- [ ] Invoke workflow.runTask with CREATE_ENVIRONMENT_REFERENCE_IMAGE
- [ ] Display result summary (generated, skipped, errors) to console
- [ ] Write integration test invoking CLI command
- [ ] Verify: Test passes, CLI executes task successfully

### Task 5.4: Update CLI help text
- [ ] Add CREATE_ENVIRONMENT_REFERENCE_IMAGE to task list in help output
- [ ] Document flags: --environment-id, --override, --resume, --verbose
- [ ] Include usage examples for batch and single modes
- [ ] Verify: Help text displays correctly

---

OPTIONAL BELOW DO NOT IMPLEMENT

## Milestone 6: Testing

### Task 6.1: Write unit tests for prompt builder
- [ ] Test extractGlobalAesthetic with valid and missing data
- [ ] Test extractEnvironmentDesign with valid ID, invalid ID
- [ ] Test buildEnvironmentReferencePrompt with snapshot assertion
- [ ] Verify prompt uses exact template from plan
- [ ] Verify: All tests pass, coverage is adequate

### Task 6.2: Write unit tests for task runner
- [ ] Test prerequisite validation (missing story, no visual design doc, no environments)
- [ ] Test batch mode processes all environments
- [ ] Test single mode processes one environment
- [ ] Test override=false skips existing images
- [ ] Test override=true regenerates existing images
- [ ] Test resume flag skips environments with paths
- [ ] Test error collection and partial batch success
- [ ] Verify: All tests pass, edge cases covered

### Task 6.3: Write integration tests for end-to-end generation
- [ ] Create test story with visual_design_document
- [ ] Mock Gemini client to return test image data
- [ ] Test batch generation saves all images and updates database
- [ ] Test single mode targets correct environment
- [ ] Test --override and --resume flags affect generation
- [ ] Verify images saved to correct paths with 16:9 aspect ratio
- [ ] Verify paths persisted in database immediately
- [ ] Verify: All integration tests pass

### Task 6.4: Write CLI integration tests
- [ ] Test CLI parses CREATE_ENVIRONMENT_REFERENCE_IMAGE command
- [ ] Test CLI parses all flags correctly
- [ ] Test CLI validates flag combinations
- [ ] Test CLI displays result summary
- [ ] Verify: CLI tests pass

---

## Milestone 7: Validation and Documentation

### Task 7.1: Run OpenSpec validation
- [ ] Execute `openspec validate add-environment-reference-task --strict`
- [ ] Resolve any validation errors
- [ ] Verify: Validation passes without errors

### Task 7.2: Update agent-backend README
- [ ] Add CREATE_ENVIRONMENT_REFERENCE_IMAGE to task list
- [ ] Document batch and single mode usage
- [ ] Document flags and their behavior
- [ ] Include example commands
- [ ] Verify: Documentation is clear and accurate

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
