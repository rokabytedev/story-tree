## ADDED Requirements
### Requirement: Store Shot Video File Paths
The shots table MUST persist a relative video path for each generated shot clip and expose repository helpers to manage the field.

#### Scenario: Shots table includes video file path column
- **GIVEN** the Supabase migrations are applied
- **WHEN** `public.shots` is inspected
- **THEN** it MUST include a nullable `video_file_path TEXT` column
- **AND** existing rows MUST default the column to NULL so prior data is unaffected
- **AND** the column MUST accept values shaped like `generated/<story-id>/shots/<scenelet-id>/shot-<index>.mp4`.

#### Scenario: Repository maps video file path field
- **GIVEN** the shots repository loads rows
- **WHEN** a shot has `video_file_path` populated
- **THEN** the returned `ShotRecord` MUST surface it as `videoFilePath`
- **AND** the property MUST be `undefined` when the database column is NULL
- **AND** creating shots MUST allow callers to provide an initial `videoFilePath` (defaulting to NULL when omitted).

#### Scenario: Repository updates shot video path
- **GIVEN** a caller provides a story id, scenelet id, shot index, and video file path
- **WHEN** `updateShotVideoPath` executes
- **THEN** it MUST update only the `video_file_path` column for the matching row
- **AND** it MUST return the refreshed `ShotRecord` with the new `videoFilePath`
- **AND** it MUST throw a descriptive error if the shot does not exist.

#### Scenario: Repository finds shots missing videos
- **GIVEN** the repository exposes `findShotsMissingVideos(storyId)`
- **WHEN** it runs for a story
- **THEN** it MUST return an array of `{ sceneletId, shotIndex, missingVideo: boolean }` entries for shots lacking `video_file_path`
- **AND** it MUST support optional filtering by scenelet id and shot index (when provided) without issuing redundant database queries.
