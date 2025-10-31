# Implementation Tasks

## 1. Database Schema
- [ ] 1.1 Create migration `supabase/migrations/000XXX_add_shots_audio_path.sql` adding `audio_file_path TEXT` column to `shots` table
- [ ] 1.2 Test migration applies successfully in local Supabase
- [ ] 1.3 Verify column is nullable and does not affect existing shots

## 2. Repository Layer
- [ ] 2.1 Update `supabase/src/shotsRepository.ts` to map `audio_file_path` column to `audioFilePath` property
- [ ] 2.2 Add `audioFilePath` to ShotRecord TypeScript interface
- [ ] 2.3 Update `createSceneletShots` to accept optional audioFilePath in input
- [ ] 2.4 Update `updateShotAudioPath` (new method) to set audio_file_path for a specific shot
- [ ] 2.5 Write repository tests in `supabase/test/shotsRepository.test.ts` covering audio path CRUD operations

## 3. Audio Design Document Types
- [ ] 3.1 Update `agent-backend/src/audio-design/types.ts` to add `character_id: string` field to AudioVoiceProfile interface
- [ ] 3.2 Update `agent-backend/src/audio-design/types.ts` to add `voice_name: string` field to AudioVoiceProfile interface
- [ ] 3.3 Create NarratorVoiceProfile interface with `character_id: "narrator"`, `voice_name`, `voice_profile` fields
- [ ] 3.4 Update AudioDesignDocument interface to add `narrator_voice_profile: NarratorVoiceProfile` at top level
- [ ] 3.5 Update audio design response validator in `agent-backend/src/audio-design/parseGeminiResponse.ts` to:
  - Import `normalizeNameToId` from `visual-design/utils.ts`
  - Generate `character_id` for each character profile using `normalizeNameToId(character_name)`
  - Keep both `character_id` and `character_name` fields (do not delete character_name)
  - Validate `narrator_voice_profile` exists at top level with `character_id: "narrator"` and `voice_name` field
  - Validate each character profile has `voice_name` field

## 4. Shot Audio Module
- [ ] 4.1 Create `agent-backend/src/shot-audio/` directory
- [ ] 4.2 Create `agent-backend/src/shot-audio/types.ts` with ShotAudioTaskDependencies, ShotAudioTaskOptions, ShotAudioTaskResult interfaces
- [ ] 4.3 Create `agent-backend/src/shot-audio/promptAssembler.ts` to filter voice profiles and assemble TTS prompt
- [ ] 4.4 Create `agent-backend/src/shot-audio/speakerAnalyzer.ts` to determine single-speaker vs multi-speaker mode
- [ ] 4.5 Create `agent-backend/src/shot-audio/geminiTtsClient.ts` wrapper for Gemini TTS API:
  - Use model `"gemini-2.5-flash-preview-tts"` for all audio generation calls
  - Support single-speaker and multi-speaker modes
  - Add verbose logging option to log full request details (model, prompt, speaker configs)
  - Redact or truncate binary audio data in logged responses (show only first 50 bytes as hex if verbose)
- [ ] 4.6 Create `agent-backend/src/shot-audio/audioFileStorage.ts` to save WAV files to public directory
- [ ] 4.7 Create `agent-backend/src/shot-audio/shotAudioTask.ts` implementing main task runner with mode logic (default/resume/override)
- [ ] 4.8 Create `agent-backend/src/shot-audio/errors.ts` for custom error types (ValidationError, UnsupportedSpeakerCountError)
- [ ] 4.9 Create `agent-backend/src/shot-audio/index.ts` exporting public API

## 5. Tests for Shot Audio Module
- [ ] 5.1 Create `agent-backend/test/shotAudioTask.test.ts` testing task runner with stub dependencies
- [ ] 5.2 Create `agent-backend/test/promptAssembler.test.ts` testing voice profile filtering and prompt assembly
- [ ] 5.3 Create `agent-backend/test/speakerAnalyzer.test.ts` testing speaker mode detection (single/multi/invalid)
- [ ] 5.4 Create test fixtures in `agent-backend/fixtures/gemini/shot-audio/` with sample single-speaker and multi-speaker responses

## 6. Workflow Integration
- [ ] 6.1 Add `CREATE_SHOT_AUDIO` to StoryWorkflowTask enum in `agent-backend/src/workflow/types.ts`
- [ ] 6.2 Add `shotAudioTaskOptions` to AgentWorkflowOptions interface
- [ ] 6.3 Implement `runShotAudioTask` function in `agent-backend/src/workflow/storyWorkflow.ts`
- [ ] 6.4 Add `CREATE_SHOT_AUDIO` case to workflow's `runTask` switch statement
- [ ] 6.5 Add audio generation step to `runAllTasks` sequence (after CREATE_SHOT_IMAGES)
- [ ] 6.6 Add prerequisite checks (audio design document must exist, shots must exist)
- [ ] 6.7 Write workflow integration tests in `agent-backend/test/storyWorkflow.test.ts`

## 7. CLI Integration
- [ ] 7.1 Add `CREATE_SHOT_AUDIO` to SUPPORTED_TASKS array in `agent-backend/src/cli/agentWorkflowCli.ts`
- [ ] 7.2 Add `--resume-shot-audio` boolean flag parsing to RunTaskCommandOptions
- [ ] 7.3 Update CLI flag parsing to support `--override` as boolean flag (no value required)
- [ ] 7.4 Add scenelet-id and shot-index flag support for single-shot mode targeting
- [ ] 7.5 Wire shot audio task options in `buildWorkflowDependencies` including mode flags
- [ ] 7.6 Add stub Gemini TTS client for `--mode stub` that returns fake WAV buffer
- [ ] 7.7 Update CLI help text with shot audio generation examples
- [ ] 7.8 Test CLI commands in both stub and real modes

## 8. Integration Testing
- [ ] 8.1 Create end-to-end integration test in `agent-backend/test/shotAudioIntegration.test.ts`
- [ ] 8.2 Test batch mode generates audio for all shots in story
- [ ] 8.3 Test resume mode skips shots with existing audio paths
- [ ] 8.4 Test override mode regenerates all shot audio
- [ ] 8.5 Test single-shot mode generates only targeted shot
- [ ] 8.6 Test validation errors for 3+ speakers
- [ ] 8.7 Test file storage creates correct directory structure
- [ ] 8.8 Verify audio_file_path updates in database after generation

## 9. Documentation
- [ ] 9.1 Update `README.md` or create `docs/shot_audio_generation.md` with usage examples
- [ ] 9.2 Document audio file path conventions and storage location
- [ ] 9.3 Add troubleshooting section for common errors (missing voice profiles, unsupported speaker counts)
- [ ] 9.4 Document Gemini TTS API voice name options for reference

## 10. Validation and Cleanup
- [ ] 10.1 Run all tests to ensure no regressions
- [ ] 10.2 Test with real Gemini API to verify TTS generation works end-to-end
- [ ] 10.3 Verify audio files are accessible via Next.js public directory
- [ ] 10.4 Run TypeScript compiler to ensure no type errors
- [ ] 10.5 Check ESLint passes with no warnings
- [ ] 10.6 Manually test CLI commands with sample story
