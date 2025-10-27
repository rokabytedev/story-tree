# Shot Prompt Generation Design

## Data Model
- Create `shot_generation_prompts` table keyed by `(story_id, scenelet_id, shot_index)` with surrogate `id` primary key.
- Columns: `story_id uuid`, `scenelet_id text`, `shot_index integer`, `first_frame_prompt text`, `key_frame_storyboard_prompt text`, `video_clip_prompt text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
- Indexes on `(story_id, scenelet_id)` and `(story_id, shot_index)` to drive workflow queries. Unique constraint on `(story_id, scenelet_id, shot_index)` ensures we never duplicate a shot.
- Repository exposes:
  - `getShotPromptsByStory(storyId)` returning map keyed by `{sceneletId, shotIndex}`.
  - `saveShotPrompt(storyId, sceneletId, shotIndex, prompts)` inserting a new row and updating `updated_at` when overwriting is explicitly requested.
  - Utilities to prune or reset shots in future iterations.

## Prompt Assembly Flow
1. Load persisted constitution markdown (string), visual design JSON, audio design JSON, storyboard breakdown array, and story tree YAML snapshot via existing repositories/loaders.
2. Accept a single storyboard shot record and build a markdown user prompt with headers:
   - `# Story Constitution`, `# Interactive Script Story Tree (YAML)`, `# Visual Design Document`, `# Audio Design Document`, `# Target Shot` (raw JSON for the shot), and `# Task Instructions` repeating JSON contract and stateless prompt rule.
3. Use `system_prompts/cinematographer_and_sound_designer.md` verbatim.
4. Provide deterministic serialization helpers to keep whitespace stable for snapshot tests (leverage existing storyboard/audio builders for formatting).

## Workflow Iteration Strategy
- Fetch storyboard shots sorted by `scenelet_id`, `shot_index`.
- Pull any previously stored prompts for the story; skip Gemini calls when the row already exists unless reset mode requested.
- For each remaining shot:
  - Assemble prompt using builder.
  - Call Gemini with shared client/options.
  - Parse/validate JSON. Validation cross-checks:
    - All three prompt strings present and > 50 chars after trimming.
    - `video_clip_prompt` explicitly states "no background music" (enforce via case-insensitive substring).
    - `dialogue` lines inside prompt reference audio design voice descriptors (string inclusion) — best-effort check.
- Persist prompts via repository; if an existing row is encountered the task should surface a duplicate-shot validation error instead of overwriting silently (future reset tooling can relax this).

## Error Handling & Observability
- Short-circuit task when storyboard or audio design missing; raise `AgentWorkflowError` with actionable messaging.
- Gracefully continue on per-shot Gemini failures by failing the task immediately (no partial success) to keep operations predictable.
- Log structured events for each shot attempt, capturing model latency and validation errors without logging full prompt strings (to avoid leaking huge payloads).
- Return summary counts (shots processed, skipped, persisted) for CLI display.

## Stub & Testing Approach
- Fixtures live under `agent-backend/fixtures/gemini/cinematography/shot-<id>.json` to keep files manageable.
- Unit tests cover prompt builder, validator, repository (with in-memory supabase client), and workflow iteration (with fake Gemini).
- Integration test runs the full workflow in stub mode with existing storyboard/audio fixtures plus new cinematography fixtures.
