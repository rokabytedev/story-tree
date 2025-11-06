# Story Task Worker & API Design

## Scope
This milestone converts persisted task rows into actionable jobs by introducing BullMQ workers and Next.js API endpoints. UI changes remain out of scope.

## Queue Architecture
- Single queue `story-task-jobs` backed by Redis (BullMQ).
- Job payload shape:
  ```ts
  interface StoryTaskJob {
    taskId: string;
    operation: 'RUN_WORKFLOW_TASK' | 'REGENERATE_CONSTITUTION' | 'BUILD_PLAYER_BUNDLE';
    storyId: string;
    options?: Record<string, unknown>;
  }
  ```
- Worker concurrency defaults to 1 (configurable via env).
- Each job lifecycle step updates Supabase:
  1. `status=running`, `progress=0` when dequeued.
  2. Call appropriate agent-backend runner.
  3. Emit progress events (`story_task_events`) as milestones complete.
  4. On success set `status=succeeded`, `progress=100`.
  5. On failure set `status=failed`, capture redacted error message.
- Cancellation support: `task_cancelled` flag stored on task record; worker checks before starting long Gemini calls and short-circuits with `status=cancelled`.

## API Endpoints
- `POST /api/story-tasks`
  - Body: `{ operation, storyId, options, autoStart? }`.
  - Creates task row via repository, enqueues BullMQ job, returns `{ taskId }`.
  - Validates operations against allowed enum, ensures required fields based on operation.
- `GET /api/story-tasks/:id`
  - Returns task record + latest events (limit 50) ordered descending.
  - Includes `cancelable` flag if status is queued or running.
- `POST /api/story-tasks/:id/cancel`
  - Marks status `cancelled` if job not yet terminal and sends BullMQ `job.discard()` + custom cancellation channel.

Authentication: rely on Next.js server environment running with Supabase service role credentials; later milestones can add user-level auth.

## Operation Mapping
- `RUN_WORKFLOW_TASK`: loads workflow via `resumeWorkflowFromStoryId`, runs the requested task (validated via `options.task`), updates progress at phase boundaries.
- `REGENERATE_CONSTITUTION`: calls `generateStoryConstitution`; progress events: queuing, generating, persisting.
- `BUILD_PLAYER_BUNDLE`: wraps `runPlayerBundleTask` and reports bundle path in final event payload.

## Error Handling
- Worker catches exceptions, logs sanitized error codes, and writes `story_task_events` with `event_type='error'`.
- API surfaces HTTP 500 with error code when job enqueue fails.
- Retries disabled by default; operations can opt-in later by setting `jobOpts.attempts`.

## Observability
- Worker exposes `/healthz` endpoint (Express or fastify) returning queue stats.
- Structured logs include `taskId`, `operation`, `storyId`, and durations.
- BullMQ events forwarded to Supabase so dashboards can monitor throughput.

## Out of Scope
- UI task drawer and realtime subscriptions.
- Constitution chat event streaming (handled in subsequent milestone).
- Role-based authorization.
