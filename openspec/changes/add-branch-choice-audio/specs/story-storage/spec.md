## ADDED Requirements
### Requirement: Store Branch Audio File Paths
Branching scenelets MUST persist the relative path to their narrated branch audio clip so downstream tasks can bundle and play the asset.

#### Scenario: Scenelets table includes branch audio column
- **GIVEN** the Supabase migrations are applied
- **WHEN** `public.scenelets` is inspected
- **THEN** it MUST include a nullable `branch_audio_file_path TEXT` column
- **AND** new rows MUST default the column to NULL
- **AND** the column MUST accept values shaped like `generated/<story-id>/branches/<scenelet-id>/branch_audio.wav`

#### Scenario: Scenelets repository exposes branch audio path
- **GIVEN** the scenelets repository returns records
- **WHEN** a row has `branch_audio_file_path` populated
- **THEN** the mapped `SceneletRecord` MUST expose it as `branchAudioFilePath: string`
- **AND** it MUST surface `undefined` when the column is NULL or empty

#### Scenario: Scenelets repository updates branch audio path
- **GIVEN** a caller provides storyId, sceneletId, and a branch audio relative path
- **WHEN** `updateBranchAudioPath` executes
- **THEN** it MUST update only the `branch_audio_file_path` column for the targeted scenelet
- **AND** it MUST accept NULL or `SKIPPED_AUDIO_PLACEHOLDER` to clear the audio path
- **AND** it MUST return the refreshed record including the new `branchAudioFilePath`
- **AND** it MUST throw a descriptive error if the scenelet does not exist
