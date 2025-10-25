## ADDED Requirements
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
