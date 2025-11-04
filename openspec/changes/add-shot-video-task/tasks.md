## Batch 1 – Storage & Domain Model
- [ ] M1.1 Add `video_file_path` column to Supabase `shots` table and update schema docs
- [ ] M1.2 Extend shots repository interfaces (`ShotRecord`, `createSceneletShots`, `findShotsMissingVideos`, `updateShotVideoPath`) with tests
- [ ] M1.3 Update agent workflow types to surface `videoFilePath` on shot records and thread through existing task dependencies
- [ ] M1.4 Validate Supabase migration locally with `supabase db reset` to confirm column defaults and null-handling

## Batch 2 – Gemini Video Task
- [ ] M2.1 Introduce `GeminiVideoClient` and stub implementation with retry support
- [ ] M2.2 Implement `shot-video` package (prompt assembler, reference image selector, task runner, errors, types)
- [ ] M2.3 Add file-system `videoStorage` helper mirroring image storage semantics
- [ ] M2.4 Write unit tests covering prompt assembly, reference prioritization, dry-run behaviour, and repository updates

## Batch 3 – Workflow & CLI Integration
- [ ] M3.1 Wire `CREATE_SHOT_VIDEO` into workflow task union, task sequence, and `runTask`
- [ ] M3.2 Extend CLI option parsing (`run-task`, help text) to support the new task, targeting flags, and `--dry-run`
- [ ] M3.3 Implement stub-mode wiring that persists fixture MP4s for generated videos
- [ ] M3.4 Add CLI integration tests for default, resume, override, dry-run, and targeting scenarios
