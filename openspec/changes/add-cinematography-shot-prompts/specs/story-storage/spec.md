## ADDED Requirements
### Requirement: Store Shot Generation Prompts
Supabase MUST persist cinematography prompts in a dedicated `shot_generation_prompts` table linked to the parent story and storyboard shot identifiers.

#### Scenario: Shot prompts table schema established
- **GIVEN** Supabase migrations are applied
- **WHEN** `public.shot_generation_prompts` is inspected
- **THEN** it MUST include `id` (UUID primary key with `gen_random_uuid()` default), `story_id` (UUID referencing `public.stories(id)` with cascade delete), `scenelet_id` (text not null), `shot_index` (integer not null), `first_frame_prompt` (text not null), `key_frame_storyboard_prompt` (text not null), `video_clip_prompt` (text not null), `created_at` (timestamptz defaulting to current UTC time), and `updated_at` (timestamptz defaulting to current UTC time)
- **AND** it MUST enforce a unique constraint on `(story_id, scenelet_id, shot_index)`
- **AND** it MUST expose indexes on `(story_id, scenelet_id)` and `(story_id, shot_index)`.

### Requirement: Provide Shot Prompt Repository API
The storage layer MUST offer helpers to query and persist shot prompts without requiring direct Supabase calls in tests.

#### Scenario: Repository fetches prompts by story
- **GIVEN** the repository is invoked with a story id that has stored shot prompts
- **WHEN** it fetches prompts
- **THEN** it MUST return a collection keyed by `scenelet_id` and `shot_index` including the three prompt strings
- **AND** it MUST exclude Supabase UUIDs from the returned structure.

#### Scenario: Repository saves new shot prompts atomically
- **GIVEN** the repository receives a story id, `scenelet_id`, `shot_index`, and the three prompt strings
- **WHEN** it saves the prompts
- **THEN** it MUST insert a new row when the `(story_id, scenelet_id, shot_index)` combination does not yet exist
- **AND** it MUST throw a descriptive error instead of silently overwriting when the combination already exists.
