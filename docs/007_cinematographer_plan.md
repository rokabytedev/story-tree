# Cinematography Task Plan

## Goal
Introduce a `CREATE_SHOT_PROMPTS` workflow task that turns every storyboard shot into three Gemini-ready prompts—`first_frame_prompt`, `key_frame_storyboard_prompt`, and `video_clip_prompt`—grounded in the constitution, interactive script, visual design, audio design, and storyboard artifacts. The task must iterate shot by shot, enforce the stateless prompt philosophy from `system_prompts/cinematographer_and_sound_designer.md`, and persist outputs in purpose-built storage so downstream renderers can consume them immediately.

## Prerequisites
- `stories.story_constitution` populated by the constitution task.
- Interactive script scenelets available through the story tree snapshot serializer (same loader used by storyboard/audio tasks).
- `stories.visual_design_document`, `stories.audio_design_document`, and `stories.storyboard_breakdown` populated by prior tasks.
- New Supabase table `shot_generation_prompts` created and wired through the storage layer to hold one row per `(story_id, scenelet_id, shot_index)`.
- Thorough familiarity with `system_prompts/cinematographer_and_sound_designer.md`; the workflow must load it verbatim.

## Gemini Prompt Assembly
Every Gemini call targets a single storyboard shot. The request format mirrors previous tasks but repeats all context to honor the “every prompt is an island” rule:

1. **System Prompt** — pass `system_prompts/cinematographer_and_sound_designer.md` verbatim.
2. **User Prompt** — markdown document assembled in this order:
   - `# Story Constitution` – raw markdown from the story record.
   - `# Interactive Script Story Tree (YAML)` – deterministic YAML snapshot plus a short reminder about scenelet and branching id conventions.
   - `# Visual Design Document` – entire visual bible JSON/markdown.
   - `# Audio Design Document` – entire audio design JSON.
   - `# Storyboard Breakdown` – include only the target shot object plus its parent scenelet metadata to limit payload size while keeping identifiers intact.
   - `# Task Instructions` – restate the JSON contract, emphasize that all prompts must be self-contained, name the required keys, and explicitly require the phrase “No background music.” inside the video clip prompt.
3. **Model Options** — reuse the shared Gemini client configuration already used by storyboard/audio tasks.

Prompt builder tests must snapshot the final string to prevent formatting regressions.

## Response Contract & Validation
Gemini returns:

```json
{
  "generation_prompts": {
    "first_frame_prompt": "…",
    "key_frame_storyboard_prompt": "…",
    "video_clip_prompt": "…"
  }
}
```

Validation rules:
- All three keys must exist and contain trimmed strings of at least 50 characters.
- `video_clip_prompt` must explicitly state that no background music plays; reject responses missing the phrase.
- Each prompt must mention every character listed in the shot and cite their visual design descriptors; verify by checking for the character names.
- Dialogue callouts in `video_clip_prompt` must quote the exact line strings from the storyboard shot and mention the matching audio design voice description.
- Track failures per shot and surface a consolidated error message so operators can pinpoint the issue quickly.

## Storage Strategy
- Add Supabase migration for `shot_generation_prompts` with columns described above, unique constraint on `(story_id, scenelet_id, shot_index)`, and supporting indexes.
- Extend the stories repository with:
  - `getShotGenerationPrompts(storyId)` returning a map keyed by `scenelet_id`/`shot_index`.
  - `insertShotGenerationPrompt(storyId, sceneletId, shotIndex, prompts)` that throws when duplicates exist; future reset tooling can handle overwrites deliberately.
- Keep the existing `stories.generation_prompts` column unused for now to avoid double sources of truth.

## Workflow Integration
- Expand the workflow task union and sequence arrays to include `CREATE_SHOT_PROMPTS` immediately after `CREATE_AUDIO_DESIGN`.
- Prerequisite checks must assert the presence of constitution, scenelets, visual design, audio design, storyboard, and the absence of stored prompts for the target story.
- Execution loop:
  1. Load storyboard shots sorted deterministically.
  2. Load cached prompts map and skip already-persisted shots.
  3. For each remaining shot, assemble the prompt, call Gemini, validate the JSON, and persist via repository.
  4. Abort the task on the first validation or Gemini failure to keep operations deterministic.
- Emit structured logs per shot containing story id, scenelet id, shot index, and elapsed time (omit prompt bodies to avoid log bloat).

## CLI Support
- Add `CREATE_SHOT_PROMPTS` to CLI enums, help text, and argument validation.
- Update `run-all` pipeline to include the new task after audio design.
- Extend stub mode fixture loader to map cinematography prompts from `agent-backend/fixtures/gemini/cinematography/` (one file per shot) and ensure `run-all --mode stub` completes end-to-end.
- Real mode should stream Gemini/validation errors to the console with actionable summaries.

## Testing Strategy
- **Prompt Builder Tests** (`agent-backend/test/cinematographyPromptBuilder.test.ts`): assert section ordering, data inclusion, and snapshot the final markdown.
- **Validator Tests** (`agent-backend/test/cinematographyResponseValidator.test.ts`): cover happy path, missing keys, short prompts, missing “no background music,” absent character names, and dialogue/voice mismatches.
- **Repository Tests** (`supabase/test/shotGenerationPromptsRepository.test.ts`): ensure inserts succeed, duplicates throw, and retrieval maps correctly.
- **Workflow Task Tests** (`agent-backend/test/cinematographyTask.test.ts`): simulate prerequisite failures, duplicate detection, Gemini errors, validation failures, and success paths.
- **Integration Tests** (`agent-backend/test/cinematographyIntegration.test.ts`): drive the full pipeline under stub mode and confirm prompts persist without altering existing artifacts.
- **CLI Tests** (`agent-backend/test/agentWorkflowCli.test.ts`): verify `CREATE_SHOT_PROMPTS` routing, stub fixture plumbing, and updated run-all flow.

## Milestones
1. **Storage Foundation** — migration, repository API, and unit coverage for `shot_generation_prompts`.
2. **Prompt Builder & Validator** — deterministic builder, validation module, and exhaustive tests.
3. **Workflow Orchestration** — task runner with per-shot iteration, logging, and task-level coverage.
4. **CLI & Integration** — CLI wiring, stub fixtures, and end-to-end integration tests.

## OpenSpec Workflow
- Change ID: `add-cinematography-shot-prompts`.
- Specifications updated: `story-workflow`, `story-storage`.
- Proposal, tasks, and design live under `openspec/changes/add-cinematography-shot-prompts/`.
- Run `openspec validate add-cinematography-shot-prompts --strict` before requesting review.

---

i changed my mind and want to introduce a major change of design.

the system_prompts/storyboard_artist.md system prompt used to create shots for all scenelets from the script. that's too much of work.
while on the other hand, system_prompts/cinematographer_and_sound_designer.md looks at all storyboard shots but only output one shot at a time, that seems too little of work.

i need to change the design to better balance the work between these two tasks. the new design should be something like:
- combine "storyboard artist" and "cinematographer / sound designer"
- instead of "storyboard artist" handles all shots at once, it will do something similar to what the current "cinematographer / sound designer" is doing - handling one shot at a time.
- but in that one request to gemini to handle one shot, it will handle more:
    - considering the whole story, the visual design and audio design, etc
    - for that specific target shot:
        - generating the story board artifacts
        - based on the story board artifacts, also generate all the 3 prompts
    - gemini will respond with both the story board artifacts and the 3 prompts
    - important: it still plays the storyboard artist responsibility and it will decide the actual shots for each scenelet (may add / remove shots from the shot_suggestions from scenelet). this part of the system prompt is important to keep.
- iterate through all the shots from the script

so this means a significant change / rewrite:
- both system prompts need to be rewritten - somewhat combined into one system prompt, with a proper name
- db schema needs updates
    - no more separate columns for storyboard
    - shots should be in its own table. each row is a shot. maybe called `shots`?
    - the new `shots` have columns for everything related to that shot, e.g.
        - ids / keys: uuid, scenelet_id, shot index etc
        - storyboard artifacts: maybe a single json column is good enough
        - columns for each prompts (or maybe a single json column? i don't know which is better. you decide)
- the workflow / task / cli all need to be changed. instead of having a CREATE_STORYBOARD and CREATE_SHOT_PROMPTS tasks. they should be a single task like CREATE_Xxx (i don't know the best name. maybe CREATE_SHOT? you decide).
- all the tests, fixtures etc need to be updated to be compatible with the new design.

your tasks:
- immerse yourself to fully understand my intention. ask clarification if you find it confusing.
- update the documents to reflect this new design and the changes needed.
- split milestones, tasks etc. follow openspec process.
- after all got my confirmation, implement.