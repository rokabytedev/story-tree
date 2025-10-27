# Scenelet Shot Production Task Plan

## Goal
Replace the separate storyboard and cinematography tasks with a single `CREATE_SHOT_PRODUCTION` workflow step that, for each scenelet, generates the complete ordered shot list (storyboard metadata plus three downstream prompts per shot) in one Gemini call. Store every shot in the dedicated `shots` table so renderers and operators share a single source of truth.

## Inputs & Context
- Story constitution markdown stored on the story record.
- Interactive script scenelets and their `shot_suggestions` exposed by the story tree snapshot serializer.
- Visual design document (global aesthetics, character and environment designs).
- Audio design document (voice profiles, sonic identity, cue philosophy).
- New system prompt `system_prompts/shot_director.md`, authored specifically for scenelet-level generation.

## Gemini Prompt Assembly
Each invocation targets one scenelet identified by `scenelet_id`. The user prompt MUST include sections in this order:
1. `# Story Constitution` — exact markdown.
2. `# Interactive Script Story Tree (YAML)` — deterministic YAML snapshot with reminder about scenelet/branch id semantics.
3. `# Visual Design Bible` — full document.
4. `# Audio Design Bible` — full document.
5. `# Target Scenelet` — full scenelet payload (dialogue, description, branching, `shot_suggestions`).
6. `# Task Directives` — reiterate atomic prompt requirement, instruct Gemini to output all shots for the scenelet in order, remind the model to weigh the director’s suggestions carefully, and restate the JSON contract including the explicit phrase “No background music.” for the `video_clip_prompt`.

Unit tests will snapshot the final assembled user prompt to catch formatting drift.

## Gemini Response Contract
Gemini returns a single JSON object:

```json
{
  "scenelet_id": "scenelet-3",
  "shots": [
    {
      "shot_index": 1,
      "storyboard_entry": {
        "framing_and_angle": "Wide establishing shot",
        "composition_and_content": "...",
        "character_action_and_emotion": "...",
        "dialogue": [
          { "character": "Finn", "line": "..." }
        ],
        "camera_dynamics": "...",
        "lighting_and_atmosphere": "...",
        "continuity_notes": "..."
      },
      "generation_prompts": {
        "first_frame_prompt": "...",
        "key_frame_storyboard_prompt": "...",
        "video_clip_prompt": "... No background music."
      }
    }
  ]
}
```

Validation expectations:
- `scenelet_id` matches the target; `shots` array is non-empty.
- `shot_index` values start at 1 and increment by 1 with no gaps.
- Prompt strings are trimmed, ≥80 characters, and the video clip prompt includes “No background music.” (case-insensitive).
- Character names and dialogue lines map exactly to the scenelet and visual design documents.

## Storage & Repository Requirements
- Supabase `shots` table stores one row per shot with fields described in the OpenSpec delta (story id, scenelet id/sequence, shot index, storyboard payload JSON, three prompt text columns, timestamps).
- Remove `stories.storyboard_breakdown` and `stories.generation_prompts` columns.
- Repository API:
  - `getShotsByScenelet(storyId, sceneletId)` returning ordered shots (without exposing UUIDs).
  - `createSceneletShots(storyId, sceneletId, shots)` inserting all shots for a scenelet and throwing if rows already exist.
  - Helper for listing scenelets missing shots to drive the workflow.

## Workflow Integration
- Task order: constitution → interactive script → visual design → audio design → shot production.
- `CREATE_SHOT_PRODUCTION` prerequisites: constitution, scenelets, visual design, audio design. Fail fast with descriptive error if any missing.
- Execution per scenelet:
  1. Fail if the scenelet already has stored shots (shot production is single-run per scenelet).
  2. Build user prompt per strategy above.
  3. Call Gemini using combined system prompt.
  4. Validate response; abort scenelet on error.
  5. Persist results via `createSceneletShots`.
- Log structured metadata (`scenelet_id`, shot count, ms elapsed) without printing prompts.

## CLI & Fixtures
- Update CLI task registry: remove `CREATE_STORYBOARD` / `CREATE_SHOT_PROMPTS`, add `CREATE_SHOT_PRODUCTION`.
- Stub fixtures: one JSON file per scenelet under `agent-backend/fixtures/gemini/shot-production/scenelet-<id>.json` following the new schema.
- Integration tests: ensure `run-all --mode stub` produces scenelet shots end-to-end and that rerunning the task is idempotent.

## Testing Plan
- **Prompt Builder Tests:** verify section ordering, emphasis on shot suggestions, snapshot final markdown.
- **Validator Tests:** cover happy path, empty shot list, non-sequential indices, missing “No background music”, unmatched dialogue/characters.
- **Repository Tests:** insert-and-conflict behaviour, ordering guarantees, cascade delete with stories/scenelets.
- **Workflow Tests:** prerequisite enforcement, single-run guard, scenelet iteration, Gemini failure propagation.
- **CLI Tests:** `CREATE_SHOT_PRODUCTION` command and stub-driven `run-all` flow.

## Milestones
1. **Schema & Repository** — Supabase migration, repository implementation, unit coverage.
2. **Prompt & Validator** — system prompt finalization, builder, validator, exhaustive tests.
3. **Workflow Task** — scenelet iteration, persistence wiring, task-level tests.
4. **CLI & Integration** — stub fixtures, CLI plumbing, integration suites, documentation refresh.

## Open Questions
- Should reruns always replace the entire scenelet or support merge behaviour? Current plan replaces the full set to guarantee deterministic ordering.
  A: always replace the entire scenelet for now. scenelet is minimal unit of update
- Do we need CLI flags to target a single scenelet, or is full-scenelet sweep acceptable for now?
  A: should support both.