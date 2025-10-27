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
  runAllTasks(): Promise<void>; // convenience wrapper sequencing the full pipeline
}

type WorkflowTask =
  | 'CREATE_CONSTITUTION'
  | 'CREATE_INTERACTIVE_SCRIPT'
  | 'CREATE_VISUAL_DESIGN'
  | 'CREATE_AUDIO_DESIGN'
  | 'CREATE_SHOT_PRODUCTION';
```
- `runTask` validates prerequisites and idempotency for every supported task. Repeat invocations of a completed task throw `AgentWorkflowError` until reset tooling exists.
- `runAllTasks` now executes the complete five-stage pipeline (constitution → interactive script → visual design → audio design → shot production) and returns the persisted constitution summary for UI compatibility.
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
  4. Flag completion by relying on scenelet presence (duplicate runs throw until reset tooling exists).
- Postconditions: Scenelets exist for story; reruns are prevented while rows remain in the `scenelets` table.

### Task: Create Visual Design (`CREATE_VISUAL_DESIGN`)
- Preconditions:
  - Constitution persisted.  
  - Interactive script generated (scenelets available via repository).
- Steps:
  1. Load constitution markdown and story summary for tonal guidance.  
  2. Optionally load interactive tree snapshot to provide branch coverage.  
  3. Execute `runVisualDesignTask` (Gemini prompt + validator).  
  4. Persist the returned `visualDesignDocument` (JSON payload) on the story record.
- Postconditions: `stories.visualDesignDocument` populated. Reruns blocked until a future reset flow clears the column.

### Task: Create Audio Design (`CREATE_AUDIO_DESIGN`)
- Preconditions:
  - Constitution and visual design artifacts exist (audio prompt references visual canon).  
- Steps:
  1. Load story record including constitution + visual design snippets.  
  2. Run `runAudioDesignTask` to generate the audio design bible.  
  3. Persist `audioDesignDocument` JSON back to the story.  
  4. Log summary metadata (e.g., cue counts) for operators.
- Postconditions: Audio design stored on the story; repeat invocations throw until reset support arrives.

### Task: Create Shot Production (`CREATE_SHOT_PRODUCTION`)
- Preconditions:
  - Constitution, visual design, and audio design all exist.  
  - Interactive scenelets are present and the `shots` table has no rows for the story (idempotency guard).
- Steps:
  1. Load the story tree snapshot to obtain ordered scenelets and branch context.  
  2. For each scenelet, assemble the combined shot director prompt (constitution + tree YAML + visual + audio + scenelet package).  
  3. Call Gemini once per scenelet, parse the JSON response, and validate structure (sequential indices, ≥80 character prompts, required phrase `"No background music."`, dialogue integrity).  
  4. Persist each scenelet’s shots into the `public.shots` table via the repository (`createSceneletShots` enforces exclusivity).  
  5. Emit structured logs summarizing shot counts and latency.
- Postconditions: All shots stored in `public.shots`; reruns rejected until the rows are cleared explicitly.

### Extensibility
- The workflow intentionally keeps tasks composable so future capabilities (e.g., visual reference packages, localization passes) can add new `WorkflowTask` values following the same prerequisite pattern.

## CLI Simplification
- Collapse modes into:
  1. `stub` – real Supabase connection (local default), Gemini responses from fixtures.  
  2. `real` – real Supabase + Gemini.  
- Remove stub-DB logic; rely on repositories used by both modes.
- CLI commands:
  - `agent-workflow run-all --prompt "..."` → creates a story and runs the full five-task pipeline.
  - `agent-workflow run-task --task CREATE_CONSTITUTION --story-id ...`
  - `agent-workflow run-task --task CREATE_INTERACTIVE_SCRIPT --story-id ...`
  - `agent-workflow run-task --task CREATE_VISUAL_DESIGN --story-id ...`
  - `agent-workflow run-task --task CREATE_AUDIO_DESIGN --story-id ...`
  - `agent-workflow run-task --task CREATE_SHOT_PRODUCTION --story-id ...`
  - `agent-workflow create --prompt "..."` → returns story ID without running tasks.
- Stub mode pulls fixtures from:
  - `agent-backend/fixtures/story-constitution/stub-gemini-responses.json`
  - `agent-backend/fixtures/interactive-story/stub-gemini-responses.json`
  - `agent-backend/fixtures/visual-design/stub-gemini-response.json`
  - `agent-backend/fixtures/gemini/audio-design/success.json`
  - `agent-backend/fixtures/gemini/shot-production/scenelet-<id>.json`
- Provide verbose logging flag and surface validation errors cleanly.

## Testing Strategy
- Maintain TDD discipline: write unit tests for each task before implementation.
- Cover constructor helpers (new vs existing story) with dependency fakes.  
- Ensure double-run scenarios throw expected errors.  
- For CLI, add integration tests that exercise stub mode and confirm repository writes.

## Open Considerations
- Decide whether to persist task completion flags in DB or infer from artifact presence; initial pass can infer, with follow-up change to add explicit `story_workflow_tasks` table if needed.
- Clarify how to reset or rerun tasks (out of scope for first iteration). If necessary, document manual Supabase cleanup steps.
