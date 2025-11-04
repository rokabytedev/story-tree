## Batch 1 – Storage & Domain Model
- [x] M1.1 Add `video_file_path` column to Supabase `shots` table and update schema docs
- [x] M1.2 Extend shots repository interfaces (`ShotRecord`, `createSceneletShots`, `findShotsMissingVideos`, `updateShotVideoPath`) with tests
- [x] M1.3 Update agent workflow types to surface `videoFilePath` on shot records and thread through existing task dependencies
- [x] M1.4 Validate Supabase migration locally with `supabase db reset` to confirm column defaults and null-handling

## Batch 2 – Gemini Video Task
- [x] M2.1 Introduce `GeminiVideoClient` and stub implementation with retry support
- [x] M2.2 Implement `shot-video` package (prompt assembler, reference image selector, task runner, errors, types)
- [x] M2.3 Add file-system `videoStorage` helper mirroring image storage semantics
- [x] M2.4 Write unit tests covering prompt assembly, reference prioritization, dry-run behaviour, and repository updates

## Batch 3 – Workflow & CLI Integration
- [x] M3.1 Wire `CREATE_SHOT_VIDEO` into workflow task union, task sequence, and `runTask`
- [x] M3.2 Extend CLI option parsing (`run-task`, help text) to support the new task, targeting flags, and `--dry-run`
- [x] M3.3 Implement stub-mode wiring that persists fixture MP4s for generated videos
- [x] M3.4 Add CLI integration tests for default, resume, override, dry-run, and targeting scenarios
