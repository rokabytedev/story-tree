## MODIFIED Requirements
### Requirement: Persist Story Artifacts in Supabase
The stories table MUST now record the player's original prompt and drop unused artifact columns, delegating shot data to the dedicated shots table.

#### Scenario: Stories table removes storyboard-specific columns
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.stories` table is inspected
- **THEN** it MUST retain `initial_prompt`, `story_constitution`, `visual_design_document`, and `audio_design_document`
- **AND** it MUST NOT include `storyboard_breakdown` or `generation_prompts` columns anymore.

### ADDED Requirements
### Requirement: Store per-shot storyboard and prompt data
Supabase MUST persist combined storyboard and generation prompt data per shot in a new `shots` table linked to the parent story.

#### Scenario: Shots table schema established
- **GIVEN** Supabase migrations are applied
- **WHEN** `public.shots` is inspected
- **THEN** it MUST expose columns `id`, `story_id`, `scenelet_id`, `scenelet_sequence`, `shot_index`, `storyboard_payload`, `first_frame_prompt`, `key_frame_prompt`, `video_clip_prompt`, `created_at`, and `updated_at`
- **AND** it MUST default `id` to `gen_random_uuid()` and timestamps to current UTC
- **AND** it MUST enforce a foreign key from `story_id` to `public.stories(id)` with cascade delete
- **AND** it MUST enforce a unique constraint on `(story_id, scenelet_id, shot_index)`
- **AND** it MUST expose an index on `(story_id, scenelet_id)` for ordered retrieval.

### Requirement: Provide Shots Repository API
The storage layer MUST offer helpers to query and persist shots without hitting Supabase during unit tests.

#### Scenario: Repository fetches shots by story
- **GIVEN** the repository is invoked with a story id that has stored shots
- **WHEN** it fetches data
- **THEN** it MUST return the shots grouped by `scenelet_id` in ascending `shot_index` order including storyboard payload and prompt strings
- **AND** it MUST exclude Supabase UUIDs from the consumer-facing structure.

#### Scenario: Repository inserts shots once per scenelet
- **GIVEN** the repository receives a story id, scenelet id, and a list of shots to persist
- **WHEN** it saves the data
- **THEN** it MUST insert the ordered shots in a single transaction when the scenelet has no existing rows
- **AND** it MUST throw a descriptive error if any shots already exist for that `(story_id, scenelet_id)` combination.
