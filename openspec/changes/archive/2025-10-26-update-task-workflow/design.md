## Overview
The orchestrator refactor introduces a stateless `StoryWorkflow` abstraction that records only the `storyId` and forwards persistence to injected repositories. Each task validates prerequisites using live Supabase data, ensuring the database remains the single source of truth.

## Components
- **StoryWorkflowFactory**  
  - `createWorkflowFromPrompt(prompt, deps)` → creates story row, returns workflow handle.  
  - `resumeWorkflow(storyId, deps)` → fetches story, throws if missing.
- **Task Registry**  
  - `WorkflowTask` enum describing supported tasks (`CREATE_CONSTITUTION`, `CREATE_INTERACTIVE_SCRIPT`).  
  - `runTask(task)` dispatches to task-specific handlers while enforcing "run once" semantics.
- **Task Handlers**  
  - Constitution handler reuses `generateStoryConstitution`, persists artifacts, and records completion by checking `stories.story_constitution`.  
  - Interactive handler loads constitution, uses `generateInteractiveStoryTree`, and records completion using scenelets presence (plus optional timestamp flag for clarity).

## Data Considerations
- Completion detection uses existing columns (constitution JSON, scenelets rows) to avoid schema churn.  
- Future expansion (e.g., manual resets) can add explicit workflow task journal without breaking the new API.

## CLI Flow
- CLI constructs workflow via factory, resolves mode configuration (stub fixtures vs real Gemini), then executes `runTask` or `runAllTasks`.  
- Stub mode injects file-backed Gemini clients while using the real Supabase repositories.

## Testing
- Unit tests cover task preconditions, dependency injection, and idempotency errors with fake repositories.  
- CLI integration tests run in stub mode to assert repository writes and output messaging.
