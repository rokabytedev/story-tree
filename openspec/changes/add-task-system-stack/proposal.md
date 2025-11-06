## Why

The Story Tree UI is read-only today, so designers cannot create, rename, or delete stories, nor can they trigger Gemini-backed revisions to artifacts without dropping into the CLI. Slow tasks such as constitution regeneration or interactive script updates require long-running Gemini calls and manual status tracking. We need a shared task system that the UI can call to mutate stories while handling long-running progress, retries, and user feedback.

## What Changes
- Introduce a Supabase-backed task registry and queue runner that wraps existing `agent-backend` workflow tasks behind durable jobs.
- Add Story Task HTTP APIs under the Next.js app that validate requests, enqueue jobs, and expose status streams for the UI.
- Extend the Story Tree UI with creation, rename/delete, and artifact regeneration flows that show real-time task progress and chat loops for constitution updates.
- Establish conventions for mapping UI operations to worker jobs, progress events, and completion payloads so future mutations reuse the same foundation.

## Impact
- Requires new Supabase tables for task/job tracking plus Redis (via BullMQ) for queue execution inside the Node workers.
- Aligns the UI, API, and worker stack on a consistent job lifecycle (`queued → running → succeeded/failed`) with structured progress updates.
- Provides a foundation to add more mutation flows (e.g., visual reference refresh, bundle rebuilds) without bespoke plumbing.
