## MODIFIED Requirements
### Requirement: Persist Story Artifacts in Supabase
The stories table MUST now record the player's original prompt and drop the unused `interactive_script` column.

#### Scenario: Stories table captures prompt and artifacts as JSON
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.stories` table is inspected
- **THEN** it MUST include an `initial_prompt` text column that stores the user brief
- **AND** it MUST include JSONB columns `story_constitution`, `visual_design_document`, `audio_design_document`, and `visual_reference_package`
- **AND** it MUST NOT include legacy storyboard columns such as `storyboard_breakdown` or `generation_prompts`
- **AND** the legacy `interactive_script` JSONB column MUST be absent.

### Requirement: Store Shot Production Output
The database MUST provide a `shots` table that persists every storyboard record and prompt set produced during shot production.

#### Scenario: Shots table schema established
- **GIVEN** Supabase migrations are applied
- **WHEN** `public.shots` is inspected
- **THEN** it MUST include `id` (UUID primary key), `story_id` (UUID referencing `public.stories(id)` with cascade delete), `scenelet_id` (text identifier for the scenelet digest), `scenelet_sequence` (positive integer), `shot_index` (positive integer), `storyboard_payload` (JSONB), `first_frame_prompt` (text), `key_frame_prompt` (text), `video_clip_prompt` (text), `created_at` (timestamp with time zone defaulting to current UTC), and `updated_at` (timestamp with time zone)
- **AND** it MUST enforce a uniqueness constraint on `(story_id, scenelet_id, shot_index)` to avoid duplicate inserts
- **AND** it MUST expose an index on `(story_id, scenelet_id, shot_index)` to support ordered retrieval.

### Requirement: Provide Shots Repository API
The storage layer MUST expose helpers for reading, inserting, and validating scenelet shots without relying on live Supabase in tests.

#### Scenario: Repository inserts exclusive scenelet shots
- **GIVEN** the repository receives a story id, scenelet id, sequence number, and ordered shots
- **WHEN** `createSceneletShots` executes
- **THEN** it MUST reject blank identifiers, non-positive sequence values, empty shot arrays, or missing prompt text
- **AND** it MUST throw a `SceneletShotsAlreadyExistError` when rows already exist for the provided story and scenelet
- **AND** when validation passes it MUST insert one row per shot with the provided storyboard payload and prompts.

#### Scenario: Repository reports shot coverage
- **GIVEN** the repository receives a story id and list of scenelet ids
- **WHEN** `findSceneletIdsMissingShots` executes
- **THEN** it MUST trim identifiers, ignore blanks, and return only the scenelet ids lacking stored shots
- **AND** it MUST surface storage errors as `ShotsRepositoryError` instances.

#### Scenario: Repository reads shots grouped by scenelet
- **GIVEN** the repository receives a story id with stored shots
- **WHEN** `getShotsByStory` executes
- **THEN** it MUST fetch rows ordered by `scenelet_sequence` and `shot_index`, group them by scenelet id, and map fields to camel-case properties for callers.
