# Implementation Tasks

## Milestone 1: Database Schema Migration

- [x] **M1.1**: Create migration file `000006_deprecate_shot_prompts.sql` to drop `first_frame_prompt`, `key_frame_prompt`, `video_clip_prompt`, and `first_frame_image_path` columns from `public.shots` table
- [x] **M1.2**: Update `supabase/test/shotsMigration.test.ts` to verify the dropped columns and ensure `storyboard_payload` remains intact
- [x] **M1.3**: Update `ShotRow` type in `supabase/src/shotsRepository.ts` to remove `first_frame_prompt`, `key_frame_prompt`, `video_clip_prompt`, and `first_frame_image_path` fields
- [x] **M1.4**: Update `ShotRecord` interface in `supabase/src/shotsRepository.ts` to remove `firstFramePrompt`, `keyFramePrompt`, `videoClipPrompt`, and `firstFrameImagePath` fields
- [x] **M1.5**: Update `CreateShotInput` interface in `supabase/src/shotsRepository.ts` to remove prompt fields and keep only `shotIndex` and `storyboardPayload`
- [x] **M1.6**: Remove prompt validation logic from `createSceneletShots` method in `supabase/src/shotsRepository.ts` (lines validating `firstFramePrompt`, `keyFramePrompt`, `videoClipPrompt`)
- [x] **M1.7**: Update `mapRowToRecord` function in `supabase/src/shotsRepository.ts` to remove prompt field mappings
- [x] **M1.8**: Update `supabase/test/shotsRepository.test.ts` to remove assertions on prompt fields and update test data
- [x] **M1.9**: Run migration tests locally to ensure backward compatibility with existing `storyboard_payload` data

## Milestone 2: Shot Production Code Updates

**Note**: `system_prompts/shot_director.md` has already been updated. Do not modify this file.

- [x] **M2.1**: Update `agent-backend/src/shot-production/types.ts` to define `AudioNarrativeEntry` type with `type`, `source`, and `line` fields
- [x] **M2.2**: Update `agent-backend/src/shot-production/types.ts` to update `ShotProductionStoryboardEntry` interface with `audio_and_narrative` array and `referenced_designs` object
- [x] **M2.3**: Update `agent-backend/src/shot-production/types.ts` to remove `ShotGenerationPrompts` interface and related types
- [x] **M2.4**: Update `agent-backend/src/shot-production/types.ts` to remove `generation_prompts` field from `ShotProductionShotRecord`
- [x] **M2.5**: Update `agent-backend/src/shot-production/parseGeminiResponse.ts` to parse `referenced_designs` object and validate character/environment ID arrays
- [x] **M2.6**: Update `agent-backend/src/shot-production/parseGeminiResponse.ts` to parse `audio_and_narrative` array and validate type discrimination
- [x] **M2.7**: Update `agent-backend/src/shot-production/parseGeminiResponse.ts` to validate dialogue entries have `source` matching valid character IDs
- [x] **M2.8**: Update `agent-backend/src/shot-production/parseGeminiResponse.ts` to validate monologue entries have `source === "narrator"`
- [x] **M2.9**: Remove `sanitizePrompts` function from `agent-backend/src/shot-production/parseGeminiResponse.ts` as it's no longer needed
- [x] **M2.10**: Remove `sanitizeDialogue` function from `agent-backend/src/shot-production/parseGeminiResponse.ts` and replace with `sanitizeAudioNarrative` that handles the new structure
- [x] **M2.11**: Update `agent-backend/src/shot-production/parseGeminiResponse.ts` to remove `RawPromptBundle` interface and related parsing
- [x] **M2.12**: Remove task directive about 80-character minimum prompt length from `agent-backend/src/shot-production/promptBuilder.ts` (line referencing MIN_PROMPT_LENGTH)
- [x] **M2.13**: Remove task directive about "No background music." phrase from `agent-backend/src/shot-production/promptBuilder.ts`

## Milestone 3: Shot Production Test Updates

- [x] **M3.1**: Update `agent-backend/fixtures/gemini/shot-production/scenelet-1.json` to include `referenced_designs` and `audio_and_narrative` fields, remove `generation_prompts`
- [x] **M3.2**: Update `agent-backend/fixtures/gemini/shot-production/scenelet-2.json` with new structure
- [x] **M3.3**: Update `agent-backend/fixtures/gemini/shot-production/scenelet-3.json` with new structure
- [x] **M3.4**: Update `agent-backend/fixtures/gemini/shot-production/scenelet-4.json` with new structure
- [x] **M3.5**: Update `agent-backend/fixtures/gemini/shot-production/scenelet-5.json` with new structure
- [x] **M3.6**: Update `agent-backend/test/shotProductionResponseValidator.test.ts` to test validation of `referenced_designs` structure
- [x] **M3.7**: Update `agent-backend/test/shotProductionResponseValidator.test.ts` to test validation of `audio_and_narrative` type discrimination
- [x] **M3.8**: Update `agent-backend/test/shotProductionResponseValidator.test.ts` to test rejection of invalid dialogue sources (not in character roster)
- [x] **M3.9**: Update `agent-backend/test/shotProductionResponseValidator.test.ts` to test rejection of invalid monologue sources (not "narrator")
- [x] **M3.10**: Remove test cases for `generation_prompts` validation from `agent-backend/test/shotProductionResponseValidator.test.ts`
- [x] **M3.11**: Update `agent-backend/test/shotProductionTask.test.ts` to remove assertions on prompt fields

## Milestone 4: Key Frame Prompt Assembly Implementation

- [x] **M4.1**: Create `agent-backend/src/shot-image/keyFramePromptAssembler.ts` with `assembleKeyFramePrompt` function signature
- [x] **M4.2**: Implement filtering logic for `character_designs` based on `referenced_designs.characters` in assembler
- [x] **M4.3**: Implement filtering logic for `environment_designs` based on `referenced_designs.environments` in assembler
- [x] **M4.4**: Implement extraction of `global_aesthetic` (visual_style + master_color_palette) from visual design document
- [x] **M4.5**: Implement exclusion of `audio_and_narrative` field from storyboard payload in assembled prompt
- [x] **M4.6**: Implement final prompt object assembly combining filtered designs and visual storyboard fields
- [x] **M4.7**: Create `agent-backend/test/keyFramePromptAssembler.test.ts` with test cases for filtering logic
- [x] **M4.8**: Add test case verifying `audio_and_narrative` exclusion from assembled prompt
- [x] **M4.9**: Add test case verifying proper filtering when shot references subset of available designs
- [x] **M4.10**: Add test case verifying error handling when referenced design IDs are not found in visual design document

## Milestone 5: Shot Image Generation Integration

- [x] **M5.1**: Update `agent-backend/src/shot-image/shotImageTask.ts` to import and use `assembleKeyFramePrompt` function
- [x] **M5.2**: Remove first frame image generation logic entirely from `shotImageTask.ts` (including `missingFirstFrame` handling)
- [x] **M5.3**: Replace usage of `shot.keyFramePrompt` with assembled prompt object in key frame image generation path
- [x] **M5.4**: Update `geminiImageClient.generateImage` call to serialize assembled prompt object to JSON string for `userPrompt` parameter
- [x] **M5.5**: Verify reference image loading logic uses `referenced_designs` from storyboard payload (this may already be working via existing `referencedDesigns` field)
- [x] **M5.6**: Remove fallback logic for shots without `referencedDesigns` (backward compatibility no longer needed after regeneration)
- [x] **M5.7**: Update error messages to reference storyboard structure instead of missing prompt fields
- [x] **M5.8**: Update `ShotImageTaskResult` to remove `generatedFirstFrameImages` counter (keep only `generatedKeyFrameImages`)
- [x] **M5.9**: Update `agent-backend/test/shotImageTask.test.ts` to mock assembled prompts instead of using string prompts
- [x] **M5.10**: Update integration test expectations to verify assembled prompt structure and remove first frame assertions

## Milestone 6: Repository Updates for First Frame Deprecation

- [x] **M6.1**: Remove `findShotsMissingImages` method logic for `missingFirstFrame` from `supabase/src/shotsRepository.ts`
- [x] **M6.2**: Update `ShotsMissingImages` interface to remove `missingFirstFrame` field (keep only `missingKeyFrame`)
- [x] **M6.3**: Update `updateShotImagePaths` to remove `firstFrameImagePath` parameter handling
- [x] **M6.4**: Update `UpdateShotImagePathsInput` interface to remove `firstFrameImagePath` field
- [x] **M6.5**: Update repository tests to remove assertions on first frame image paths

## Milestone 7: Type System and Interface Updates

- [x] **M7.1**: Update `agent-backend/src/shot-image/types.ts` to remove references to prompt string fields and `firstFrameImagePath` if present
- [x] **M7.2**: Update `agent-backend/src/shot-production/shotProductionTask.ts` to remove prompt field handling when persisting shots
- [x] **M7.3**: Update repository call in shot production task to pass only `shotIndex` and `storyboardPayload` in `CreateShotInput`
- [x] **M7.4**: Search codebase for any remaining references to deprecated prompt fields using `rg "firstFramePrompt|keyFramePrompt|videoClipPrompt|firstFrameImagePath"` and remove them
- [x] **M7.5**: Search for any UI code displaying prompt or first frame image fields and update to show only key frame data

## Milestone 8: Testing and Validation

- [x] **M8.1**: Run all unit tests in `agent-backend/test/` and verify passing
- [x] **M8.2**: Run all integration tests in `supabase/test/` and verify passing
- [ ] **M8.3**: Manually test shot production flow: create story → generate shots → verify new storyboard structure in database
- [ ] **M8.4**: Manually test key frame image generation flow: generate images → verify assembled prompt is used → verify images do not contain text overlays
- [x] **M8.5**: Verify reference image loading correctly filters based on `referenced_designs.characters` and `referenced_designs.environments`
- [x] **M8.6**: Test error handling: verify clear error messages when referenced design IDs are missing from visual design document
- [x] **M8.7**: Verify first frame generation is completely removed from all code paths
- [ ] **M8.8**: Run full end-to-end workflow: story creation → constitution → interactive script → visual design → shot production → key frame image generation

## Milestone 9: Documentation and Cleanup

- [x] **M9.1**: Update any API documentation referencing shot prompt fields to describe new storyboard structure
- [x] **M9.2**: Update developer docs to explain the new prompt assembly approach vs old generation approach
- [x] **M9.3**: Add migration guide for regenerating shots in existing stories if needed
- [x] **M9.4**: Remove any commented-out code related to old prompt generation logic
- [x] **M9.5**: Update CLI help text if it references prompt fields

## Notes

- **Breaking Change**: This change is backward-incompatible. Existing shots in the database will lose prompt fields and first frame image paths. Stories under active development should regenerate shots after deployment.
- **First Frame Fully Deprecated**: First frame image generation is completely removed. Only key frame images will be generated going forward.
- **Out of Scope**: Video clip prompt assembly is explicitly out of scope. The `video_clip_prompt` field is removed but video generation is not updated in this change.
- **System Prompt Already Updated**: `system_prompts/shot_director.md` has already been updated with the new output format. Do not modify this file during implementation.
