# Story Task UI Controls Design

## Scope
Deliver end-user interfaces that leverage the Story Task API to manage story creation and artifact mutations. Backend changes are out of scope.

## Architecture
- Use `@tanstack/react-query` for REST endpoints and cache invalidation.
- Supabase Realtime subscriptions listen to `story_tasks` / `story_task_events` channels filtered by `story_id` or `task_id`.
- Client components run only in CSR contexts (Next.js Client Components) while pages remain Server Components.

## Key Components
1. **Task Drawer (`TaskDrawer.tsx`)**
   - Accepts `storyId` and optional `taskId`.
   - Fetches initial data via `GET /api/story-tasks/:id` and `GET /api/stories/:id/tasks`.
   - Opens Supabase channel `story_tasks:storyId` and merges incoming events into React Query cache.
   - Displays queued/running/completed sections with progress bars and timestamps.

2. **New Story Modal**
   - Collects prompt input, optional toggles for auto-run stages.
   - Calls `POST /api/story-tasks` with `operation='CREATE_STORY'` and shows Task Drawer inline until success.
   - On completion invalidates story list query and focuses new card.

3. **Story Header Actions**
   - Buttons: Rename, Delete, Run Task.
   - Rename uses synchronous `PATCH /api/story/:id` (if we keep synchronous path) or enqueues `RENAME_STORY` task; optimistic update with rollback toast.
   - Delete enqueues `DELETE_STORY` and disables other actions while running.

4. **Constitution Chat Panel**
   - Chat interface storing local history while job runs.
   - Submits to API with `operation='CONSTITUTION_CHAT_UPDATE'`.
   - Streams `chat_message` events (markdown deltas) and refreshes page data on completion.

## UX Considerations
- Display status badges (Queued, Running, Succeeded, Failed, Cancelled).
- Provide retry CTA for failed tasks (enqueues new job using same payload).
- Show relative timestamps and durations using existing date helpers.

## Testing Strategy
- Component unit tests using Jest/React Testing Library with mocked Supabase channel client.
- Playwright smoke tests covering create story flow, rename failure rollback, and constitution chat success.

## Out of Scope
- Additional backend operations beyond those already supported.
- Role-based permissions (assume trusted operators).
- Mobile-specific layouts (desktop-first, with responsive design backlog).
