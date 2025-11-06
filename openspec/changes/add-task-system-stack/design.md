# Task System Architecture Design

## Overview

We will turn the read-only Story Tree UI into a control surface for story creation and artifact maintenance. The design introduces a shared task system that persists job metadata in Supabase, processes slow Gemini calls inside a BullMQ worker, and streams progress back to the Next.js UI. The stack reuses the existing `agent-backend` task runners so we avoid duplicating Gemini prompt logic while gaining durable job orchestration.

```
┌──────────┐      POST /api/story-tasks       ┌────────────┐        BullMQ        ┌───────────┐
│  Story    │ ───────────────────────────────> │ Story Task  │ ──────────────────> │ Task       │
│  Tree UI  │  Supabase Realtime task_events  │  API (Next) │   job enqueue       │  Worker    │
└──────────┘ <─────────────────────────────── └────────────┘ <─────────────────── └───────────┘
    ▲                    progress SSE/WebSocket          Redis events + Supabase writes     │
    │                                                                                       │
    └─────────────────────── Supabase `story_tasks` + `story_task_events` updates <──────────┘
```

## Data Model

Two new Supabase tables capture job lifecycle and progress:

| Table | Purpose |
|-------|---------|
| `story_tasks` | One row per user-initiated operation. Tracks `id (uuid)`, `story_id (uuid nullable)`, `operation (text enum)`, `status (queued|running|succeeded|failed|cancelled)`, `progress (int 0-100)`, `display_fields (jsonb)` for UI, `requested_by`, timestamps, and an `payload (jsonb)` blob with inputs. |
| `story_task_events` | Append-only log keyed by `task_id`. Stores `event_type (progress|info|error|chat_message)`, `step`, `message`, optional `payload`, `progress_override`, and timestamps. |

Foreign keys enforce cascade delete when a story is removed. Indexes support `story_id` filtering and `status` dashboards. Real-time broadcasts will be enabled on both tables so the UI can subscribe via Supabase Realtime channels (`supabase.channel('story_tasks:storyId')`).

### State Machine

```
queued → running → (succeeded | failed | cancelled)
```

- Only the worker mutates `status` to `running` or terminal states.
- `progress` defaults to `0` and can only move forward; events may override incremental values.
- Terminal states freeze `progress` at 100 (success) or last reported percentage.

## Queue & Worker

- Use **BullMQ** backed by Redis (fits Node.js stack, battle-tested for async jobs, supports retries, and exposes progress APIs we can map to Supabase).
- Jobs live in a single queue `story-task-jobs` with job data:

```ts
type StoryTaskJob = {
  taskId: string;
  operation: StoryTaskOperation;
  storyId?: string;
  payload: Record<string, unknown>;
};
```

- Worker service (new workspace `task-worker/`) boots BullMQ `Worker`, loads Supabase service credentials, and instantiates required repositories + `agent-backend` task runners.
- For Gemini-heavy jobs, reuse existing implementations:
  - Constitution + chat loops → `story-constitution` module.
  - Workflow tasks (interactive script, visual design, etc.) → `workflow/storyWorkflow.ts`.
- Worker writes progress by:
  1. Calling `bullJob.updateProgress(percent)`.
  2. Persisting to Supabase via `story_tasks.progress` and inserting human-readable `story_task_events`.
- Errors are caught, logged, and persisted with `status = failed` plus a final error event (sanitised message).
- Concurrency default 1 (Gemini rate-limited). Configurable via env (`TASK_WORKER_CONCURRENCY`).

### Task Catalogue

| Operation | Description | Execution Path |
|-----------|-------------|----------------|
| `CREATE_STORY` | Creates story row and optionally seeds pipeline tasks | API creates row synchronously; worker generates constitution when `autoGenerate` flag set |
| `RENAME_STORY` | Updates `display_name` | API performs directly (writes success event) |
| `DELETE_STORY` | Deletes story + cascade artifacts | API schedules job so worker can clean files and DB |
| `REGENERATE_CONSTITUTION` | Gemini call to refresh constitution | Worker invokes `generateStoryConstitution` and updates story |
| `CONSTITUTION_CHAT_UPDATE` | Iterative chat to modify sections | Worker streams chat turns, storing each Gemini response as `chat_message` events, and performs final patch |
| `RUN_WORKFLOW_TASK` | Generic wrapper for `StoryWorkflow.runTask` (visual design, audio, etc.) | Worker loads workflow handle and executes selected task |
| `BUILD_PLAYER_BUNDLE` | Rebuilds playable bundle assets | Worker wraps existing bundle task |

All operations share the same event schema so UI components render consistently.

## API Layer (Next.js Routes)

Route handlers live under `apps/story-tree-ui/src/app/api/story-tasks`. Requests use Zod for validation and Supabase service role via server-side session.

| Route | Purpose |
|-------|---------|
| `POST /api/story-tasks` | Enqueue a new task. Body: `{ operation, storyId?, payload }`. Returns `{ taskId }`. Validates permissions (future: role-based). |
| `GET /api/story-tasks/:taskId` | Returns task status, progress, recent events. |
| `GET /api/stories/:id/tasks` | Lists active/recent tasks for a story (pagination). |
| `POST /api/story-tasks/:taskId/cancel` | Marks job as cancelled (only while queued/running). Worker listens for cancellation via BullMQ `job.update` and stops work cooperatively. |

For fast operations (rename story), route handler performs work inline but still writes a `story_tasks` row and success event to deliver a unified UX.

### Authentication & Authorization

- UI uses existing Supabase service role (server-side) to call APIs; we will add a lightweight signed JWT check for client-initiated mutations to restrict to trusted operators.
- Each task row records `requested_by` (UUID from Supabase auth) for audit; API rejects anonymous calls when we eventually add auth UI.

## UI Enhancements

Key surfaces:

1. **Story Index CTA** – “New Story” button opens a modal with prompt input and optional toggles (auto-run constitution, include interactive script). After submission the modal transitions to a task progress view.
2. **Story Detail Header Actions** – Buttons for Rename, Delete, Run Task. Rename executes synchronous API call and invalidates queries; Delete enqueues job and disables actions until completion.
3. **Task Drawer** – Reusable component that subscribes to `story_tasks` + `story_task_events` via Supabase Realtime using the story ID. Shows checklist of active jobs, progress bars, and event stream (timestamped). Completed jobs collapse into history.
4. **Constitution Chat Panel** – Slide-over panel attached to the Constitution tab. Uses client component + `@tanstack/react-query` to call `POST /api/story-tasks` with operation `CONSTITUTION_CHAT_UPDATE`, renders chat transcript by mapping `chat_message` events, and shows final diff when job succeeds.

### Handling Slow Operations

- `TaskDrawer` merges initial REST fetch (`GET /api/story-tasks/:id`) with real-time updates. When a progress event arrives, update local cache, show spinner, and toast completion/failure.
- When job fails, UI displays actionable error message and keeps task in history for troubleshooting.
- Optimistic UI for rename operations: update story list immediately, reconcile if job fails.

## Observability & Failures

- Worker logs to stdout (structured JSON) and also emits a final `error` event with `code` and redacted `details`.
- Add retention policy: nightly job to prune tasks older than 30 days (future).
- Include metrics scaffolding (BullMQ exposes `completed`, `failed` counts; we can expose `/metrics` later).

## Dependencies & Tooling

- **BullMQ + ioredis** for queue + worker coordination.
- **Zod** for request validation.
- **@tanstack/react-query** for client data fetching and caching.
- **Supabase Realtime** (already in project) for pushing task updates.
- Worker reuses existing `agent-backend` modules; no duplication of Gemini prompts.

This architecture gives us a single source of truth for mutations, isolates long-running Gemini operations from the Next.js runtime, and delivers real-time feedback to users operating the Story Tree UI.
