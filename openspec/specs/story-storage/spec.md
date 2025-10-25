# story-storage Specification

## Purpose
TBD - created by archiving change add-supabase-storage-layer. Update Purpose after archive.
## Requirements
### Requirement: Persist Story Artifacts in Supabase
The database MUST provide a `stories` table that stores interactive story metadata and generated artifacts.

#### Scenario: Stories table captures artifacts as JSON
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.stories` table is inspected
- **THEN** it MUST include columns `id` (UUID primary key), `display_name` (text), `created_at` (timestamp with time zone defaulting to the current UTC time), and `updated_at` (timestamp with time zone automatically updated on row changes)
- **AND** it MUST include JSONB columns named `story_constitution`, `interactive_script`, `visual_design_document`, `audio_design_document`, `visual_reference_package`, `storyboard_breakdown`, and `generation_prompts`
- **AND** each JSONB column MUST default to `NULL` with no additional constraints so partial artifacts can be saved incrementally.

#### Scenario: Stories table supports UUID generation and update timestamps
- **GIVEN** a new story row is inserted without specifying `id` or `created_at`
- **THEN** the migration MUST supply default expressions that set `id` via `gen_random_uuid()` and `created_at` to the current UTC time
- **AND** subsequent updates MUST automatically refresh `updated_at` without manual timestamp handling in application code.

### Requirement: Provide Stories Repository API
A TypeScript repository MUST expose a typed interface for interacting with the `stories` table via Supabase.

#### Scenario: Create story helper returns persisted record metadata
- **GIVEN** a caller provides a display name and optional artifact payloads
- **WHEN** the repository `createStory` helper executes
- **THEN** it MUST call Supabase to insert a row into `stories`
- **AND** it MUST return the inserted row including the generated `id`, timestamps, and any stored artifact JSON.

#### Scenario: Update helper persists artifact deltas safely
- **GIVEN** a caller provides a story `id` and a partial set of artifact fields to update
- **WHEN** the repository `updateStoryArtifacts` helper executes
- **THEN** it MUST patch only the supplied columns using Supabase `update`
- **AND** it MUST surface an error when Supabase reports failures or the story is missing.

#### Scenario: Fetch helper retrieves story by id
- **GIVEN** a caller requests a persisted story `id`
- **WHEN** the repository `getStoryById` helper executes
- **THEN** it MUST return the stored row typed as a `StoryRecord`
- **AND** it MUST return `null` when no matching story exists.

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

#### Scenario: Default local project configuration
- **GIVEN** a developer runs the CLI without connection flags
- **THEN** it MUST target the local Supabase project using the default service credentials (e.g. environment variables or Supabase emulator defaults).

#### Scenario: Remote project override
- **GIVEN** the CLI is launched with a remote mode flag and service credentials for the hosted Supabase project
- **THEN** it MUST connect to the remote Supabase project using those credentials
- **AND** it MUST fail fast with a clear error when required remote credentials are missing.

#### Scenario: Create story command returns id
- **GIVEN** the developer runs the CLI `create` command with an optional display name
- **WHEN** the command succeeds
- **THEN** it MUST insert a new story via the stories repository and print the persisted story id to stdout.

#### Scenario: Update constitution command accepts text or file
- **GIVEN** the developer runs the CLI `set-constitution` command for a story id
- **WHEN** they supply constitution content either through a command-line argument or by referencing an input file
- **THEN** the CLI MUST load the constitution text accordingly and update the story via the stories repository
- **AND** it MUST exit non-zero with a descriptive error if the story id is missing or the repository reports the story was not found.

#### Scenario: List command prints story summaries
- **GIVEN** the developer runs the CLI `list` command
- **THEN** it MUST fetch all stories via the repository and print each story id and display name to stdout in a human-readable format
- **AND** it MUST exit zero even when no stories exist (printing nothing beyond optional headers).

#### Scenario: Show command returns story details
- **GIVEN** the developer runs the CLI `show` command with a story id
- **THEN** it MUST load that story via the repository and print the full record as JSON to stdout
- **AND** it MUST exit non-zero with a descriptive error when the story is missing or the id argument is not provided.

