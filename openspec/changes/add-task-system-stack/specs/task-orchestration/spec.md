## ADDED Requirements
### Requirement: Persist Story Task Jobs in Supabase
The backend MUST store every story mutation request as a durable record in Supabase.

#### Scenario: Task row captures lifecycle metadata
- **GIVEN** the API receives a mutation request
- **WHEN** it creates a task
- **THEN** it MUST insert a row into `story_tasks` with `id`, `operation`, `status`, `progress`, `payload`, `requested_by`, and optional `story_id`
- **AND** it MUST append a `story_task_events` entry with the initial queued message for audit.

### Requirement: Provide Story Task API Endpoints
The Next.js app MUST expose HTTP routes for enqueuing tasks, reading status, and cancelling jobs.

#### Scenario: Enqueue returns task identifier
- **GIVEN** a client posts to `/api/story-tasks` with a valid payload
- **WHEN** validation succeeds
- **THEN** the API MUST persist the task row, enqueue a BullMQ job, and respond with `{ taskId }`
- **AND** it MUST reject invalid operations with a 422 response that includes validation errors.

#### Scenario: Status endpoint streams progress
- **GIVEN** a task is running
- **WHEN** the client calls `GET /api/story-tasks/{taskId}`
- **THEN** the API MUST return `status`, `progress`, and the latest events sorted descending by created time
- **AND** it MUST handle soft-deleted stories by keeping historical task data accessible.

### Requirement: Worker Executes Tasks and Emits Events
The task worker MUST process queued jobs using BullMQ, call the appropriate agent-backend routines, and stream progress back to Supabase.

#### Scenario: Worker updates progress during long-running job
- **GIVEN** a `RUN_WORKFLOW_TASK` job is dequeued
- **WHEN** the worker completes intermediate phases (e.g., Gemini call started, data persisted)
- **THEN** it MUST update `story_tasks.progress` and insert `story_task_events` rows describing each milestone
- **AND** Supabase Realtime MUST broadcast those changes so UI subscribers receive them.

#### Scenario: Worker surfaces failure details
- **GIVEN** an agent-backend call throws an error
- **WHEN** the worker handles the exception
- **THEN** it MUST mark the task as `failed`, set `progress` to the last reported value, and append an error event with a redacted message and machine-readable `code`
- **AND** it MUST leave the BullMQ job in the failed state for observability without retrying automatically unless the task definition allows retries.

#### Scenario: Constitution chat records transcript
- **GIVEN** a `CONSTITUTION_CHAT_UPDATE` job is running
- **WHEN** the worker exchanges turns with Gemini
- **THEN** it MUST persist each user prompt and Gemini response as ordered `chat_message` events
- **AND** after applying the final markdown update it MUST append a completion event referencing the updated constitution version identifier.
