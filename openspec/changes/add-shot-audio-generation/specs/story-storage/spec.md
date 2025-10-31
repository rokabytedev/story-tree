# story-storage Spec Deltas

## ADDED Requirements

### Requirement: Store Shot Audio File Paths
The shots table MUST include an audio_file_path column to store the relative path to generated audio files for each shot.

#### Scenario: Shots table includes audio file path column
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.shots` table is inspected
- **THEN** it MUST include an `audio_file_path` column of type TEXT
- **AND** the column MUST be nullable to allow shots without generated audio
- **AND** existing shots without audio MUST NOT be affected by the schema change

#### Scenario: Repository maps audio file path field
- **GIVEN** the shots repository returns shot records
- **WHEN** a shot row includes `audio_file_path`
- **THEN** the repository MUST surface it as `audioFilePath` property
- **AND** the property MUST be undefined when the database column is NULL
- **AND** the property type MUST be `string | undefined`

#### Scenario: Repository updates shot audio path
- **GIVEN** a caller provides a story id, scenelet id, shot index, and audio file path
- **WHEN** the repository updates the shot's audio path
- **THEN** it MUST set `audio_file_path` to the provided relative path value
- **AND** it MUST return the updated shot record with the new audioFilePath
- **AND** it MUST throw an error if the shot does not exist

#### Scenario: Repository creates shots with optional audio paths
- **GIVEN** the repository receives shots to persist with optional audioFilePath values
- **WHEN** `createSceneletShots` executes
- **THEN** it MUST accept audioFilePath as an optional field in the input
- **AND** it MUST persist the value to `audio_file_path` when provided
- **AND** it MUST insert NULL when audioFilePath is not provided

## MODIFIED Requirements

### Requirement: Provide Shots Repository API
The repository MUST expose shot records including audio file paths and provide methods to update audio paths after generation.

#### Scenario: Repository reads shots with audio file paths
- **GIVEN** shots are stored with audio_file_path values
- **WHEN** `getShotsByStory` executes
- **THEN** it MUST return shot records with `audioFilePath` property containing the relative path
- **AND** it MUST group shots by scenelet and order them by `scenelet_sequence` and `shot_index`
- **AND** shots without audio MUST have `audioFilePath` as undefined

#### Scenario: Repository provides audio path update method
- **GIVEN** a shot exists in the database
- **WHEN** `updateShotAudioPath` is called with story id, scenelet id, shot index, and file path
- **THEN** it MUST locate the shot by the unique constraint (story_id, scenelet_id, shot_index)
- **AND** it MUST update only the `audio_file_path` column without modifying other fields
- **AND** it MUST return the refreshed shot record
- **AND** it MUST throw a descriptive error if the shot is not found
