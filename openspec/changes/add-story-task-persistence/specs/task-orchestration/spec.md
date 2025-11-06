## ADDED Requirements
### Requirement: Persist Story Task Records
The backend MUST capture every story mutation request in dedicated Supabase tables before any queueing or UI work occurs.

#### Scenario: Task persistence schema exists
- **GIVEN** Supabase migrations are applied
- **WHEN** the database schema is inspected
- **THEN** it MUST include `story_tasks` with lifecycle columns (operation, status, progress, payload, requested_by, timestamps)
- **AND** it MUST include `story_task_events` referencing `story_tasks(id)` with cascade delete and realtime enabled.

#### Scenario: Repository creates task and event rows
- **GIVEN** the repository receives a valid create request
- **WHEN** it executes
- **THEN** it MUST insert a task row, returning the persisted record with generated id and normalized JSON fields
- **AND** when `appendEvent` is called it MUST add a `story_task_events` row linked to the task.

#### Scenario: Agent backend logs updates via helper
- **GIVEN** the agent backend calls the task logging helper
- **WHEN** it records start, progress, or completion metadata
- **THEN** the helper MUST persist through the repository without referencing queue infrastructure
- **AND** repeated calls MUST update `status`, `progress`, and append events atomically.
