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
- **AND** it MUST include JSONB columns `story_constitution`, `visual_design_document`, `audio_design_document`, `visual_reference_package`, `storyboard_breakdown`, and `generation_prompts`
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

