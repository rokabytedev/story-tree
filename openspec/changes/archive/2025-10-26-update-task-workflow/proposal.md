## Why
- Current agent workflow is monolithic; callers cannot run individual steps (constitution only, interactive only).
- Team needs stateless workflow handles so Supabase stays the single source of truth and tasks can be retried or resumed.
- CLI complexity (stub DB vs real) slows testing and obscures real-world behaviour.

## What Changes
- Introduce `StoryWorkflow` factories for new and existing stories that expose `runTask`/`runAllTasks`.
- Split the orchestrator into discrete tasks (`CREATE_CONSTITUTION`, `CREATE_INTERACTIVE_SCRIPT`) with prerequisite validation and idempotency checks.
- Refactor legacy `runAgentWorkflow` to reuse the task primitives.
- Simplify CLI to two modes (stub fixtures vs real Gemini) and add commands for per-task execution.
- Update `story-workflow` spec to capture task-based behaviour and idempotency constraints.

## Impact
- Enables partial reruns and future automation hooks (e.g., resume failed tasks).
- Keeps TDD viability by injecting dependencies into each task function.
- CLI becomes easier to operate in local and CI environments.
