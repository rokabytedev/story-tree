## ADDED Requirements
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
