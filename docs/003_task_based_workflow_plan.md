# Task-Based Agent Workflow Plan

## Goals
- Allow product teams to run individual workflow stages without replaying the entire pipeline.
- Keep story state in Supabase and make runtime workflow objects effectively stateless.
- Provide a migration path from the current `runAgentWorkflow` orchestration into reusable task primitives.
- Simplify the CLI to expose the new task-based flow while retaining an easy way to run the full sequence.

## Current Limitations
- `runAgentWorkflow` assumes a brand-new story prompt and always executes constitution and interactive generation end to end.
- The workflow object couples task orchestration, story creation, and artifact persistence, making partial reruns and retries difficult.
- The CLI supports multiple stub/real combinations (including stub DB) which adds branching code paths and makes testing harder.

## Proposed Workflow Structure

### Workflow Lifecycle
1. **Create new workflow**  
   - Input: user brief prompt. Reject missing/blank prompts (`AgentWorkflowError`).  
   - Action: create placeholder story row (display name via existing factory).  
   - Output: `StoryWorkflow` handle containing only `storyId`.
2. **Attach to existing workflow**  
   - Input: story ID.  
   - Action: fetch story record via repository; error if not found.  
   - Output: same stateless `StoryWorkflow` handle (cache only `storyId`).
3. **State boundaries**  
   - Runtime object stores `storyId` and dependency graph (repositories, generators, loggers).  
   - All reads/writes go through repositories so Supabase remains the source of truth.  
   - Guard against stale data by re-reading required artifacts before each task.

### Core API Surface
```typescript
interface StoryWorkflow {
  storyId: string;
  runTask(task: WorkflowTask): Promise<void>;
  runAllTasks(): Promise<void>; // convenience wrapper sequencing supported tasks
}

type WorkflowTask = 'CREATE_CONSTITUTION' | 'CREATE_INTERACTIVE_SCRIPT';
```
- `runTask` validates prerequisites and idempotency. Repeat invocations of a completed task throw `AgentWorkflowError` for now.
- `runAllTasks` mirrors the current behaviour: sequentially invoke the two tasks and surface the final constitution metadata for compatibility.
- Factory helpers (`createWorkflowFromPrompt`, `resumeWorkflowFromStoryId`) live in `agent-backend/src/workflow`.

## Task Catalogue

### Task: Create Story Constitution (`CREATE_CONSTITUTION`)
- Preconditions:
  - Story row exists and does **not** yet have a constitution.
  - Initial prompt is available (set during workflow creation).
- Steps:
  1. Derive input prompt from DB (normalize whitespace).  
  2. Run `generateStoryConstitution` (allow dependency override for testing).  
  3. Persist constitution payload (`displayName`, `storyConstitution`) via repository.  
  4. Emit structured logs for observability.
- Postconditions: Story row populated with constitution; task recorded as completed (boolean column or workflow task journal table — minimal version can re-check `storyConstitution` column).

### Task: Create Interactive Script (`CREATE_INTERACTIVE_SCRIPT`)
- Preconditions:
  - Constitution task completed (`storyConstitution` exists).  
  - No prior interactive generation run (scenelets table does not contain rows for this story or store completion flag). For initial version, treat presence of any scenelets as “already generated”.
- Steps:
  1. Load constitution markdown from DB.  
  2. Invoke `generateInteractiveStoryTree`, injecting `sceneletPersistence`.  
  3. Persist scenelets through the provided adapter.  
  4. Flag completion (e.g., new `interactive_script_generated_at` timestamp on stories).
- Postconditions: Scenelets exist for story; completion flag prevents reruns until reset tooling exists.

### Future Tasks
- Leave extension point for `CREATE_VISUAL_DESIGN`, `CREATE_AUDIO_DESIGN`, etc. Each new task should declare prerequisites and completion signals.

## CLI Simplification
- Collapse modes into:
  1. `stub` – real Supabase connection (local default), Gemini responses from fixtures.  
  2. `real` – real Supabase + Gemini.  
- Remove stub-DB logic; rely on repositories used by both modes.
- CLI commands:
  - `agent-workflow run-all --prompt "..."` → creates new workflow and runs `runAllTasks`.
  - `agent-workflow run-task --task CREATE_CONSTITUTION --story-id ...`
  - `agent-workflow create --prompt "..."` → returns story ID without running tasks.
- Provide verbose logging flag and surface validation errors cleanly.

## Testing Strategy
- Maintain TDD discipline: write unit tests for each task before implementation.
- Cover constructor helpers (new vs existing story) with dependency fakes.  
- Ensure double-run scenarios throw expected errors.  
- For CLI, add integration tests that exercise stub mode and confirm repository writes.

## Open Considerations
- Decide whether to persist task completion flags in DB or infer from artifact presence; initial pass can infer, with follow-up change to add explicit `story_workflow_tasks` table if needed.
- Clarify how to reset or rerun tasks (out of scope for first iteration). If necessary, document manual Supabase cleanup steps.
