# Interactive Script Resume & Gemini Reliability Plan

## Goals
- Add an exponential backoff retry strategy (with a hard retry ceiling) for every Gemini JSON invocation so transient outages stop terminating long-running tasks.
- Allow the `CREATE_INTERACTIVE_SCRIPT` workflow task to resume previously-started story trees without discarding the existing scenelets.
- Leave the CLI as a thin transport: the workflow itself decides whether to resume or fail fast.

## Non-Goals
- No UX changes for downstream tasks (visual design, audio, etc.) beyond receiving a completed tree.
- No schema migrations beyond what the resume algorithm needs (scenelet storage already contains sufficient fields).
- No attempt to de-duplicate or reconcile divergent scenelet content; resume assumes the stored scenelets are authoritative.

## Current Gaps
- Gemini calls are single-shot; a transient `GeminiRateLimitError` or network blip aborts the entire interactive script run.
- The workflow blocks reruns by checking `sceneletPersistence.hasSceneletsForStory` and throwing, forcing operators to drop data manually.
- Partial scenelet graphs are not recoverable: the generator always starts from an empty stack and immediately creates a duplicate root.

## Proposed Changes

### 1. Gemini Request Reliability
- Introduce a reusable `executeGeminiWithRetry(request, options)` helper inside `agent-backend/src/gemini/` that wraps `GeminiJsonClient.generateJson`.
  - Default policy: `maxAttempts = 5`, `initialDelayMs = 2000`, `multiplier = 2`, `maxDelayMs = 30000`, and full jitter (`delay = random(0.5, 1.5) * currentDelay`).
  - If the error is `GeminiRateLimitError`, respect `retryAfterMs` when it exceeds the computed delay.
  - Retry `GeminiApiError` only when the underlying `ApiError` status is 5xx/`UNAVAILABLE`; surface client-side failures immediately.
  - Emit structured debug logs (`attempt`, `delayMs`, `errorType`) and expose a hook in options for task-level loggers.
- Update `createGeminiJsonClient` to use the helper by default; callers injecting custom clients can opt out or override the retry policy via an optional `retryPolicy` field in `GeminiGenerateJsonOptions`.
- Ensure fixture/stub clients used in tests bypass waiting by short-circuiting the delay scheduler (e.g., dependency-injected `sleep` util).

### 2. Workflow-Level Resume Toggle
- Extend `AgentWorkflowOptions` with `resumeInteractiveScript?: boolean` (default `false`).
- Modify `StoryWorkflowImpl.runInteractiveScriptTask`:
  1. Check `hasSceneletsForStory`.
  2. If `false`, behave exactly as today.
  3. If `true` and `resumeInteractiveScript` is not enabled, keep throwing `Interactive script already generated…`.
  4. If `true` and resume enabled, invoke the resume path (see below) instead of short-circuiting.
- When resume is requested, surface precise log messages indicating whether we resume, finish immediately (already complete), or abort because of corruption.

### 3. Scenelet Persistence Extensions
- Expand `SceneletPersistence` with a new `listSceneletsByStory(storyId): Promise<SceneletRecord[]>` method. This is **not** a brand-new storage query—we will reuse the existing Supabase `SceneletsRepository.listSceneletsByStory` that already powers the YAML serializer, keeping a single source of truth for fetching raw scenelets.
- Add a lightweight runtime validator that narrows `SceneletRecord.content` to `ScriptwriterScenelet`. Fail with `InteractiveStoryError` if any stored scenelet is malformed; resume should not proceed on inconsistent data.

### 4. Resume Algorithm
1. Fetch all scenelets for the story and index them by `id` and `parentId`.
2. Validate invariants:
   - Exactly one root (`parentId === null`).
   - No cycles (detected during traversal).
   - `isTerminalNode` scenelets must have zero children; flag and fail otherwise.
3. Traverse depth-first from the root, constructing:
   - `pathContext`: ordered `ScriptwriterScenelet[]` (deep copies) from the root to the current node.
   - `children`: sorted by `createdAt` to retain deterministic order.
4. Classify each node:
   - **Complete leaf**: `isTerminalNode === true` → nothing to do.
   - **Pending linear node**: `isBranchPoint === false`, `isTerminalNode === false`, `children.length === 0` → enqueue a `GenerationTask` with `parentSceneletId = node.id` and the accumulated `pathContext`.
   - **Branch node sanity**: when `isBranchPoint === true`, the database should already contain every child scenelet Gemini returned alongside the branch. If any branch node is missing children we will treat it as corruption and fail fast (see Edge Cases).
   - For nodes with children, continue traversal into those children with their own `pathContext`.
5. If no pending tasks remain, treat the story as already complete and exit successfully.
6. Otherwise, seed the generator with the pending stack (ordered so the final stack preserves the original depth-first behaviour) and resume Gemini calls.

### 5. Generator Enhancements
- Extend `generateInteractiveStoryTree` signature to accept an optional `resumeState`:
  ```ts
  export interface InteractiveStoryResumeState {
    pendingTasks: GenerationTask[];
  }
  ```
- Initial stack logic:
  - If `resumeState.pendingTasks.length > 0`, start from a clone of that list.
  - Otherwise, fall back to the current single root task.
- While executing, reuse existing `handleLinearResponse`/`handleBranchResponse`/`handleConcludingResponse`.
  - For branch retries (`markSceneletAsBranchPoint` already true), skip the mark when the target is already flagged and keep generating children.
- Replace direct `geminiClient.generateJson` calls with the new retry helper so both fresh runs and resumes benefit from exponential backoff.

### 6. CLI & Flag Plumbing
- Add a `--resume-interactive-script` boolean flag to the workflow CLI that toggles `resumeInteractiveScript` inside `AgentWorkflowOptions`.
- Keep task-level behaviour centralized in the workflow: older scripts that call the workflow directly can set the flag without touching the CLI.

### 7. Observability
- Extend existing log metadata to include `resumeMode: true|false`, `pendingTaskCount`, and per-attempt retry diagnostics.
- Surface a concise summary after resume completes (`resumedScenelets`, `elapsedMs`, `newSceneletsCreated`).

## Edge Cases & Failure Handling
- If multiple roots or orphaned children are detected, abort resume with a descriptive `InteractiveStoryError`—operators must clean the data manually.
- When a stored scenelet content cannot be parsed into `ScriptwriterScenelet`, stop immediately rather than attempting to regenerate branches with corrupt context.
- If the resume run fails mid-way, the next invocation can reuse the same algorithm (idempotent pending-task detection).

## Testing Plan
- TDD is key principle.
- **Gemini Retry**: unit tests verifying retry count, jitter bounds, `retryAfterMs` handling, and no retries on fatal 4xx errors.
- **Resume Planner**: unit tests for graphs covering:
  - linear chains with unfinished tail,
  - branch nodes missing children,
  - already-complete trees,
  - invalid configurations (multiple roots, terminal nodes with children).
- **Generator Integration**: extend `interactiveStoryGenerator.test.ts` to seed `resumeState` and assert that only missing scenelets are created.
- **Workflow Tests**: new coverage for `resumeInteractiveScript: true/false`, including the “do nothing” path when the tree is already complete.
- **CLI Tests**: ensure the new flag sets the option and that stub mode prints the expected summary.

## Open Questions
- Do we need a configurable retry policy per task (e.g., audio design vs. interactive story)? For now, we rely on the global defaults with the option to override via `GeminiGenerateJsonOptions.retryPolicy`. We'll adjust if specific tasks demand different tolerances.
    - no, not for now. keep it simple.
- > Expand `SceneletPersistence` with a new `listSceneletsByStory(storyId): Promise<SceneletRecord[]>` method.
    - We will reuse the existing Supabase `SceneletsRepository.listSceneletsByStory` (used by the YAML serializer) and simply surface it through the `SceneletPersistence` interface so the generator can fetch the same records without duplicating queries.
- > **Pending branch expansion**: `isBranchPoint === true`, `children.length === 0` → enqueue the same `GenerationTask` (this triggers Gemini to regenerate the branching scenelets).
    - Agreed—under normal generation the branch response stores the parent prompt and all children atomically, so a branch with zero children means the data is corrupted. The resume planner will detect this and abort rather than attempting to regenerate in place.
- Should we treat branch nodes with *some* children but not all as recoverable (generate only missing choice labels) or fail hard? Initial recommendation: fail hard to avoid partial duplication; we can revisit if operators need partial healing.
    - Confirmed: partial branches indicate serious corruption. Resume will fail fast so operators can inspect the data manually.
