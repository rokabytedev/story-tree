# Implementation Tasks

## Task 1: Update Reference Image Recommender Type Definitions
**Estimated effort**: 15 minutes

- [x] Add optional `visualDesignDocument` parameter to `ReferenceImageRecommenderInput` interface in `agent-backend/src/reference-images/types.ts`
- [x] Import `VisualDesignDocument` type from visual design module
- [x] Update JSDoc to document the new parameter and its behavior

**Dependencies**: None
**Validation**: TypeScript compilation passes

---

## Task 2: Refactor Character Path Resolution in Recommender
**Estimated effort**: 30 minutes

- [x] Modify `buildCharacterRecommendations` function in `referenceImageRecommender.ts`
- [x] Add conditional logic: if `visualDesignDocument` provided, read from `character_designs[*].character_model_sheet_image_path`
- [x] Maintain fallback to hardcoded pattern construction when `visualDesignDocument` is not provided
- [x] Throw error if referenced character has missing/empty path when using visual design document
- [x] Error message must guide user to run CREATE_CHARACTER_MODEL_SHEET

**Dependencies**: Task 1
**Validation**: Existing unit tests pass; add new unit test for visual design document path

---

## Task 3: Refactor Environment Path Resolution in Recommender
**Estimated effort**: 30 minutes

- [x] Modify `buildEnvironmentRecommendations` function in `referenceImageRecommender.ts`
- [x] Add conditional logic: if `visualDesignDocument` provided, read from `environment_designs[*].environment_reference_image_path`
- [x] Maintain fallback to hardcoded pattern construction when `visualDesignDocument` is not provided
- [x] Throw error if referenced environment has missing/empty path when using visual design document
- [x] Error message must guide user to run CREATE_ENVIRONMENT_REFERENCE_IMAGE

**Dependencies**: Task 1
**Validation**: Existing unit tests pass; add new unit test for visual design document path

---

## Task 4: Update Shot Image Task to Load Visual Design Document
**Estimated effort**: 20 minutes

- [x] Modify `runShotImageTask` in `shotImageTask.ts` to extract `visualDesignDocument` from loaded story
- [x] Add validation: throw error if visual design document is missing
- [x] Pass `visualDesignDocument` to `recommendReferenceImages` call
- [x] Update error messages to reference visual design document instead of visual reference package

**Dependencies**: Tasks 2, 3
**Validation**: Integration test verifies visual design document is loaded correctly

---

## Task 5: Add Unit Tests for Visual Design Document Path Resolution
**Estimated effort**: 45 minutes

- [x] Add test case in `referenceImageRecommender.test.ts` for character path loading from visual design document
- [x] Add test case for environment path loading from visual design document
- [x] Add test case for missing/empty paths (must throw error with guidance)
- [x] Add test case for missing files (must throw error with file path)
- [x] Add test case for prioritization (characters before environments)
- [x] Add test case for maxImages limit enforcement
- [x] Verify backward compatibility tests still pass (without visual design document)

**Dependencies**: Tasks 2, 3
**Validation**: All tests pass; coverage maintained or improved

---

## Task 6: Update Shot Image Integration Tests
**Estimated effort**: 30 minutes

- [x] Update `shotImageTask.test.ts` to include visual design document in mock story data
- [x] Add test scenario: shot generation with character model sheet paths from visual design
- [x] Add test scenario: shot generation with environment reference paths from visual design
- [x] Add test scenario: shot generation fails when referenced image path is missing
- [x] Add test scenario: shot generation fails when referenced image file doesn't exist
- [x] Verify error handling when visual design document is missing

**Dependencies**: Task 4
**Validation**: All integration tests pass

---

## Task 7: Update Documentation and Error Messages
**Estimated effort**: 15 minutes

- [x] Update JSDoc comments in `shotImageTask.ts` to reflect visual design document dependency
- [x] Update error messages to guide users toward visual design document requirements
- [x] Update inline comments to clarify new vs. legacy path resolution

**Dependencies**: Tasks 2, 3, 4
**Validation**: Code review confirms clarity

---

## Task 8: Manual End-to-End Testing
**Estimated effort**: 30 minutes

- [ ] Generate a test story with visual design document
- [ ] Generate character model sheets (paths populated)
- [ ] Generate environment references (paths populated)
- [ ] Run shot image generation and verify correct reference images loaded
- [ ] Test scenario with missing character model sheet path (verify task fails with guidance)
- [ ] Test scenario with missing environment reference path (verify task fails with guidance)
- [ ] Test scenario with missing image file (verify task fails with file path)
- [ ] Verify error messages are clear and actionable

**Dependencies**: All previous tasks
**Validation**: Shot images generated successfully with correct references

---

## Summary

**Total estimated effort**: ~4 hours
**Parallelizable work**: Tasks 2 and 3 can be done concurrently; Tasks 5 and 6 can be done concurrently
**Critical path**: Task 1 → Task 2/3 → Task 4 → Tasks 5/6 → Task 7 → Task 8
