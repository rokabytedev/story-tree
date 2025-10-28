## MODIFIED Requirements
### Requirement: Render Story Artifact Tabs
The Story Tree UI MUST render story artifacts fetched from Supabase and gracefully handle stories that lack specific outputs.

#### Scenario: Tabs show Supabase artifacts
- **GIVEN** Supabase stores constitution markdown, scenelets, visual design JSON, audio design JSON, and visual reference JSON for a story
- **WHEN** the user switches between tabs in the story detail view
- **THEN** the Constitution tab MUST render the markdown stored in Supabase
- **AND** the Script tab MUST render the YAML snapshot generated from Supabase scenelets
- **AND** the Visual and Audio tabs MUST render formatted JSON derived from Supabase artifacts without reloading the page.

#### Scenario: Tabs show empty state when artifacts missing
- **GIVEN** a story is missing one or more of the Supabase artifact fields
- **WHEN** the user opens an artifact tab with no data
- **THEN** the tab MUST render an informative empty state describing which artifact is unavailable
- **AND** it MUST NOT rely on bundled mock data or crash the page.

## ADDED Requirements
### Requirement: Load Story Directory from Supabase
The Story Tree UI MUST list stories from Supabase so users can browse real artifacts.

#### Scenario: Story index pulls Supabase summaries
- **GIVEN** Supabase contains at least one story row
- **WHEN** the user opens `/story`
- **THEN** the page MUST fetch story ids and display names from Supabase
- **AND** each entry MUST link to `/story/{id}/constitution` without bundling mock data.

#### Scenario: Story directory handles empty Supabase results
- **GIVEN** Supabase returns zero stories or credentials are missing
- **WHEN** the user opens `/story`
- **THEN** the page MUST render an empty state that instructs the developer to configure Supabase or seed stories
- **AND** it MUST NOT render stale mock entries.

### Requirement: Configure Supabase Mode via Environment
Developers MUST be able to switch the UI between local and remote Supabase projects using environment variables.

#### Scenario: Environment toggles Supabase mode
- **GIVEN** `STORY_TREE_SUPABASE_MODE=remote` and `SUPABASE_REMOTE_URL` / `SUPABASE_REMOTE_SERVICE_ROLE_KEY` are defined
- **WHEN** the UI starts
- **THEN** it MUST connect using the remote credentials
- **AND** when `STORY_TREE_SUPABASE_MODE` is omitted or set to `local`, it MUST fall back to `SUPABASE_LOCAL_URL` / `SUPABASE_LOCAL_SERVICE_ROLE_KEY` (with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` as final fallback) without code changes.

#### Scenario: Missing credentials raise actionable error
- **GIVEN** the selected Supabase mode lacks the necessary URL or service role key
- **WHEN** the UI attempts to create the Supabase client
- **THEN** it MUST surface a descriptive configuration error that downstream pages translate into an empty state
- **AND** it MUST NOT attempt to use undefined credentials.
