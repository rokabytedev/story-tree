## Why

The Story Tree UI needs a durable backend record of story mutations before we can expose interactive controls. Today there is no table or repository for tracking task requests, making it impossible to coordinate UI, API, and worker responsibilities or show progress history.

## What Changes
- Add Supabase migrations for `story_tasks` and `story_task_events` tables with indexes and realtime enabled.
- Create a TypeScript repository inside the Supabase workspace for reading and writing task rows and events.
- Provide agent-backend helpers to record task creation and append structured events (without enqueuing jobs yet).

## Impact
- Establishes a single source of truth for task metadata that later milestones can reuse for queues and UI subscriptions.
- Requires database migrations and repository unit tests but no runtime queue infrastructure yet.
- Unlocks auditing of manual CLI operations while we roll out UI-driven flows incrementally.
