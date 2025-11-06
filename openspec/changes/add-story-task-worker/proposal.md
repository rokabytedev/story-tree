## Why

With task persistence in place, we need an asynchronous worker to execute slow Gemini operations and an API surface the UI can call. This milestone delivers the queue infrastructure and minimal HTTP endpoints so client features can build atop a stable interface.

## What Changes
- Add a BullMQ-based worker service that pulls story task jobs, invokes agent-backend routines, and writes status updates back to Supabase.
- Implement Next.js API routes for creating tasks, checking status, and cancelling jobs, using the new repository from the persistence milestone.
- Define operation-to-runner mappings (e.g., `RUN_WORKFLOW_TASK`, `REGENERATE_CONSTITUTION`) and guardrails for retry and cancellation behaviour.

## Impact
- Introduces Redis as a required dependency for the worker service.
- Provides a consistent lifecycle (`queued → running → succeeded/failed`) visible through Supabase records and API payloads.
- Unlocks integration testing between API handlers and the worker using stubbed task runners.
