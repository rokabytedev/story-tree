# story-storage Specification

## Purpose
TBD - created by archiving change add-supabase-storage-layer. Update Purpose after archive.
## Requirements
### Requirement: Persist Story Artifacts in Supabase
The stories table MUST now record the player's original prompt and drop the unused `interactive_script` column.

#### Scenario: Stories table captures prompt and artifacts as JSON
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.stories` table is inspected
- **THEN** it MUST include an `initial_prompt` text column that stores the user brief
- **AND** it MUST include JSONB columns `story_constitution`, `visual_design_document`, `audio_design_document`, and `visual_reference_package`
- **AND** it MUST NOT include legacy storyboard columns such as `storyboard_breakdown` or `generation_prompts`
- **AND** the legacy `interactive_script` JSONB column MUST be absent.

### Requirement: Provide Stories Repository API
The repository MUST expose the stored prompt and stop referencing the removed column.

#### Scenario: Repository maps prompt field
- **GIVEN** the stories repository returns a record
- **WHEN** the story row includes `initial_prompt`
- **THEN** the repository MUST surface it as `initialPrompt`
- **AND** it MUST NOT expose an `interactiveScript` property anymore.

#### Scenario: Repository updates display name
- **GIVEN** a caller provides a story id and new title
- **WHEN** the repository helper updates the story
- **THEN** it MUST set `display_name` to the provided value alongside any artifact changes
- **AND** it MUST return the refreshed record.

#### Scenario: Repository maps visual reference package
- **GIVEN** a story row includes `visual_reference_package`
- **WHEN** the repository loads or updates artifacts
- **THEN** it MUST surface the value as `visualReferencePackage`
- **AND** `updateStoryArtifacts` MUST allow callers to persist a validated visual reference package without overwriting other artifacts
- **AND** repository tests MUST cover round-tripping the visual reference package during create and update flows.

### Requirement: Supabase Workspace and Local Tooling
Supabase resources MUST live under a dedicated root `supabase/` directory with local development guidance.

#### Scenario: Supabase folder hosts config, migrations, and docs
- **GIVEN** the repository root is inspected
- **THEN** it MUST contain a `supabase/` directory with `config.toml`, a `migrations/` subdirectory containing the schema migration for `stories`, and a README that documents installing the Supabase CLI, running the local stack, and applying migrations.

### Requirement: Automate Supabase Schema Deployment
Database migrations MUST deploy to the remote Supabase instance automatically on merges to `main`.

#### Scenario: GitHub workflow pushes migrations to production Supabase
- **GIVEN** changes under `supabase/` merge into the `main` branch
- **WHEN** GitHub Actions runs the Supabase deployment workflow
- **THEN** the workflow MUST install the Supabase CLI, link to the production project using secrets, and execute `supabase db push`
- **AND** it MUST exit non-zero if the deployment fails.

### Requirement: Provide Supabase Stories CLI
A developer-facing CLI MUST wrap the Supabase stories repository so engineers can seed and inspect story rows during testing.

#### Scenario: Delete command removes story records
- **GIVEN** the developer runs the CLI `delete` command with a story id
- **THEN** it MUST delete the story via the repository and print a confirmation message
- **AND** it MUST exit non-zero with a descriptive error when the story is missing or the repository reports a failure.

### Requirement: Store Scenelets in Supabase
The database MUST provide a `scenelets` table that records interactive story nodes linked to their parent scenelets and story.

#### Scenario: Scenelets table schema established
- **GIVEN** Supabase migrations are applied
- **WHEN** `public.scenelets` is inspected
- **THEN** it MUST include `id` (UUID primary key with `gen_random_uuid()` default), `story_id` (UUID referencing `public.stories(id)` with cascade delete), `parent_id` (nullable UUID referencing `public.scenelets(id)` with cascade delete), `choice_label_from_parent` (nullable text), `choice_prompt` (nullable text), `content` (JSONB not null), `is_branch_point` (boolean default false), `is_terminal_node` (boolean default false), and `created_at` (timestamp with time zone defaulting to current UTC time)
- **AND** it MUST expose indexes on `story_id` and `parent_id` to enable branch lookups.

### Requirement: Scenelets Repository API
A TypeScript repository MUST expose persistence helpers for inserting scenelets, marking branch points, and fetching narratives for the generator without performing live Supabase calls in tests.

#### Scenario: Repository persists scenelets with metadata
- **GIVEN** the repository receives a new scenelet payload with story id, parent id, choice label, and content JSON
- **WHEN** it executes
- **THEN** it MUST insert a row into `public.scenelets` and return the saved record including generated id and timestamps
- **AND** it MUST provide helpers to mark `is_branch_point` with `choice_prompt` and to flag terminal nodes for concluding scenes.

### Requirement: Provide Story Tree Snapshot
The storage layer MUST expose a repository method that returns the full interactive script as a YAML-ready story tree snapshot for a given story id.

#### Scenario: Story tree snapshot lists nodes and branches
- **GIVEN** the repository is invoked with a story id that has scenelets
- **WHEN** it returns the story tree snapshot
- **THEN** the payload MUST provide sequential human-readable ids for every scenelet (`scenelet-1`, `scenelet-2`, …) and branching point (`branching-point-1`, …)
- **AND** each scenelet entry MUST expose `role`, `description`, `dialogue`, `shot_suggestions`, and an optional `choice_label` when the scenelet originates from a branch
- **AND** each branching point entry MUST expose its `choice_prompt` and an array of `{ label, leads_to }` pairs referencing the scenelet ids
- **AND** it MUST include a deterministic YAML string that mixes scenelets and branching points in depth-first order to match the visual design prompt example
- **AND** the YAML output MUST omit the `role` field for linear continuations to keep the structure lightweight
- **AND** the method MUST throw an error if the story lacks a root scenelet or contains orphaned children.

#### Scenario: Snapshot avoids exposing Supabase identifiers
- **GIVEN** scenelets are persisted with UUID primary keys
- **WHEN** the story tree snapshot is generated
- **THEN** it MUST omit Supabase UUIDs from the output
- **AND** it MUST use the stable sequential ids everywhere those nodes are referenced.

#### Scenario: Snapshot separates IO and assembly
- **GIVEN** unit tests construct fake scenelets without hitting Supabase
- **WHEN** the story tree assembler runs
- **THEN** it MUST operate purely on in-memory data structures
- **AND** the database querying logic MUST be isolated so tests can supply scenelets directly without a live connection.

### Requirement: Store Shot Production Output
The shots table MUST store complete storyboard entries in JSONB format without persisting redundant generation prompt strings.

#### Scenario: Shots table excludes prompt and first frame columns
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.shots` table is inspected
- **THEN** it MUST NOT include `first_frame_prompt`, `key_frame_prompt`, `video_clip_prompt`, or `first_frame_image_path` columns
- **AND** it MUST include `storyboard_payload JSONB NOT NULL` to store the complete storyboard entry
- **AND** it MUST include only `key_frame_image_path` for generated image storage (first frame generation is deprecated).

#### Scenario: Storyboard payload stores structured audio narrative
- **GIVEN** a shot is persisted after shot production
- **WHEN** the `storyboard_payload` JSONB is inspected
- **THEN** it MUST contain an `audio_and_narrative` array field
- **AND** each array element MUST have `type`, `source`, and `line` fields
- **AND** it MUST contain a `referenced_designs` object with `characters` and `environments` arrays.

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

