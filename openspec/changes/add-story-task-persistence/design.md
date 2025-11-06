# Story Task Persistence Design

## Scope
This milestone introduces the persistent storage layer for story tasks without adding queue workers or UI interactions. We focus on two Supabase tables and thin TypeScript facades.

## Data Model

### `story_tasks`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `story_id UUID NULL REFERENCES public.stories(id) ON DELETE SET NULL`
- `operation TEXT NOT NULL` (validated via check constraint against known operations)
- `status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled'))`
- `progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100)`
- `payload JSONB NOT NULL DEFAULT '{}'::jsonb`
- `requested_by UUID NULL REFERENCES auth.users(id)`
- `display_fields JSONB NULL` (cached title, description for UI cards)
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes: `(story_id, created_at DESC)` for dashboards and `(status)` for queue monitors. Realtime is enabled on this table to broadcast inserts/updates.

### `story_task_events`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id UUID NOT NULL REFERENCES story_tasks(id) ON DELETE CASCADE`
- `event_type TEXT NOT NULL CHECK (event_type IN ('info','progress','error','chat_message'))`
- `message TEXT NOT NULL`
- `payload JSONB NULL`
- `progress_override INTEGER NULL CHECK (progress_override BETWEEN 0 AND 100)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Index `(task_id, created_at ASC)` powers chronological queries. Realtime broadcasts events to subscribers for future milestones.

## Repository API
Located at `supabase/src/storyTasksRepository.ts`:

```ts
interface StoryTaskRecord { /* mirrors columns */ }
interface StoryTaskEventRecord { /* mirrors event columns */ }

interface StoryTasksRepository {
  createTask(input: CreateStoryTaskInput): Promise<StoryTaskRecord>;
  appendEvent(taskId: string, event: CreateStoryTaskEventInput): Promise<StoryTaskEventRecord>;
  updateStatus(taskId: string, patch: StoryTaskStatusPatch): Promise<StoryTaskRecord>;
  listRecentByStory(storyId: string, limit?: number): Promise<StoryTaskRecord[]>;
}
```

The repository follows the existing pattern used for `stories` and `scenelets`, including descriptive error classes and Vitest coverage that exercises success, validation failures, and foreign key errors using the Supabase test client harness.

## Agent-Backend Integration
We will surface a small helper in `agent-backend/src/task-logging` that receives the repository and wraps CLI or future worker calls:

```ts
async function logTaskStart(repo, { storyId, operation, payload, requestedBy }) { /* create */ }
async function logTaskEvent(repo, taskId, event) { /* append */ }
async function logTaskCompletion(repo, taskId, status, progress?) { /* update */ }
```

These helpers allow CLI tooling to immediately adopt the persistence layer without waiting for the queue milestone, providing early validation of the schema.

## Out of Scope
- Queue workers, BullMQ integration, and API endpoints (later milestones).
- UI subscriptions or realtime listeners.
- Constitution chat or task-specific semantics beyond logging.
