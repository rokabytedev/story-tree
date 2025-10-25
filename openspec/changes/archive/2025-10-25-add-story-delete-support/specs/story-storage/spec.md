## MODIFIED Requirements
### Requirement: Provide Stories Repository API
A TypeScript repository MUST expose a typed interface for interacting with the `stories` table via Supabase.

#### Scenario: Delete helper removes story by id
- **GIVEN** a caller provides a story `id`
- **WHEN** the repository `deleteStoryById` helper executes
- **THEN** it MUST call Supabase to delete the matching row
- **AND** it MUST throw a `StoryNotFoundError` when no row was deleted
- **AND** it MUST wrap delete failures reported by Supabase in `StoriesRepositoryError`.

### Requirement: Provide Supabase Stories CLI
A developer-facing CLI MUST wrap the Supabase stories repository so engineers can seed and inspect story rows during testing.

#### Scenario: Delete command removes story records
- **GIVEN** the developer runs the CLI `delete` command with a story id
- **THEN** it MUST delete the story via the repository and print a confirmation message
- **AND** it MUST exit non-zero with a descriptive error when the story is missing or the repository reports a failure.
