## Overview
Interactive story generation currently stops at the first Gemini error and cannot resume after persisting partial scenelets. We will introduce a retry wrapper around Gemini JSON invocations and a resume planner that inspects stored scenelets to seed the generator with pending tasks.

## Gemini Retry Strategy
- Wrap `GeminiJsonClient.generateJson` calls with `executeGeminiWithRetry`.
- Defaults: 5 attempts, 2s initial delay, exponential factor 2, capped at 30s, full jitter.
- Respect `GeminiRateLimitError.retryAfterMs` when larger than computed delay.
- Retry only server-side failures (5xx/`UNAVAILABLE`); propagate validation or client-side errors.
- Provide dependency-injected sleep/timer for deterministic testing; allow overrides via `GeminiGenerateJsonOptions.retryPolicy`.

## Resume Planner
- Fetch existing scenelets using the existing repository method (`listSceneletsByStory`).
- Build parent/child index, ensuring a single root, no cycles, and that terminal nodes have no children.
- Traverse depth-first, carrying a cloned path context of `ScriptwriterScenelet`s.
- Classify nodes:
  - Terminal → skip.
  - Non-branch nodes without children → enqueue new generation tasks.
  - Branch nodes must already have persisted children; otherwise treat as corruption and abort.
- If no pending tasks remain the tree is complete and resume exits early.
- Otherwise seed the generator stack with the pending tasks (last-in-first-out order preserved).

## Generator Changes
- Accept optional `resumeState` (pending task list) and initialize the stack accordingly.
- When a resumed task processes a branch whose parent is already marked as branch point, skip re-marking but continue persisting children.
- Swap direct Gemini calls for the retry helper.

## Workflow Integration
- Add `resumeInteractiveScript` flag to workflow options; default remains fail-fast when scenelets already exist.
- When the flag is enabled and stored scenelets are present, construct resume state, log diagnostics, and run the generator.
- CLI exposes `--resume-interactive-script` to propagate the flag; existing behaviour unchanged otherwise.

## Observability
- Include `resumeMode`, pending task counts, attempt counters, and delay metadata in debug logs.
- Summarize resume outcomes (new scenelets count, elapsed time) for operator awareness.
