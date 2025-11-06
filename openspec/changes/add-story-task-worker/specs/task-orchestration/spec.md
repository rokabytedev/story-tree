## MODIFIED Requirements
### Requirement: Persist Story Task Records
The backend MUST capture every story mutation request in dedicated Supabase tables before any queueing or UI work occurs.

#### Scenario: Task persistence schema exists
- **WHEN** Supabase migrations from the persistence milestone and worker milestone are applied
- **THEN** the schema MUST still expose `story_tasks` and `story_task_events` with the original constraints, plus any new columns required for cancellation flags without breaking existing callers.

#### Scenario: Repository creates task and event rows
- **WHEN** the repository is exercised during API enqueue or worker updates
- **THEN** it MUST keep inserting and returning normalized records, including new cancellation or retry metadata without regressing existing behaviour.

### ADDED Requirements
### Requirement: Queue and API Orchestrate Story Tasks
The backend MUST expose queue-driven execution and HTTP APIs so clients can request and monitor long-running work.

#### Scenario: Enqueue API schedules job
- **GIVEN** a caller posts a valid task payload to `/api/story-tasks`
- **WHEN** the handler runs
- **THEN** it MUST create the task row, enqueue a BullMQ job with the same `taskId`, and respond with the identifier
- **AND** it MUST reject invalid operations or missing story IDs with a 422 validation error.

#### Scenario: Worker updates status and progress
- **GIVEN** a BullMQ job starts running
- **WHEN** the underlying agent-backend runner reaches progress milestones
- **THEN** the worker MUST set `status=running`, update `progress`, and append events describing each milestone until the task is terminal.

#### Scenario: Cancellation stops execution
- **GIVEN** a user posts to `/api/story-tasks/{taskId}/cancel` while the task is queued or running
- **WHEN** the worker checks the cancellation flag
- **THEN** it MUST halt further Gemini calls, set `status=cancelled`, and record a final cancellation event.

#### Scenario: Status endpoint exposes recent events
- **GIVEN** a task has executed events
- **WHEN** a client calls `GET /api/story-tasks/{taskId}`
- **THEN** the API MUST return the task record plus the most recent events ordered by newest first, truncated to the configured page size.
