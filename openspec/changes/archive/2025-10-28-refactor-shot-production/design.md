# Shot Production Redesign

## Overview
Unify storyboard generation and cinematography/audio prompt creation into a single workflow that processes one scenelet per Gemini call. For each target scenelet, the agent consumes the full creative context, interprets the director’s shot suggestions, determines the exact set and ordering of shots, and returns storyboard metadata plus the three downstream generation prompts for every shot in that scenelet. The workflow iterates scenelets sequentially, persisting results into a dedicated shots table.

## Storage Model
- **Table:** `public.shots`
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE`
  - `scenelet_id TEXT NOT NULL`
  - `scenelet_sequence INTEGER NOT NULL` – deterministic ordering from the story tree snapshot.
  - `shot_index INTEGER NOT NULL` – 1-based index relative to the scenelet, assigned in the order Gemini returns shots.
  - `storyboard_payload JSONB` – framing/composition/camera/dialogue metadata for the shot.
  - `first_frame_prompt TEXT NOT NULL`
  - `key_frame_prompt TEXT NOT NULL`
  - `video_clip_prompt TEXT NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Unique constraint on `(story_id, scenelet_id, shot_index)` to enforce deterministic ordering.
- Index on `(story_id, scenelet_id)` to load shots for a scenelet efficiently.
- Remove `stories.storyboard_breakdown` and `stories.generation_prompts` columns; all shot data now lives in `shots`.

## Prompt Assembly
- Inputs pulled via repository/story tree loader: constitution markdown, interactive script YAML snapshot, visual design document, audio design document.
- For each scenelet request construct markdown sections:
  1. `# Story Constitution`
  2. `# Interactive Script Story Tree (YAML)`
  3. `# Visual Design Bible`
  4. `# Audio Design Bible`
  5. `# Target Scenelet` – includes scenelet metadata, dialogue, branching context, and the director’s initial `shot_suggestions`.
-  6. `# Task Directives` – reiterate stateless prompt rule, remind the model to evaluate the director’s `shot_suggestions` critically before finalizing its own sequence, require that all shots for the scenelet be returned in order, insist on the phrase “No background music.” in each video clip prompt, and describe the JSON output schema.
- System prompt lives at `system_prompts/shot_director.md` and must explain the combined responsibilities, scenelet-scoped workflow, and expectations for dialogue allocation/prompt verbosity.

## Gemini Response Contract
```json
{
  "scenelet_id": "scenelet-3",
  "shots": [
    {
      "shot_index": 1,
      "storyboard_entry": {
        "framing_and_angle": "Medium Close-Up",
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
        "video_clip_prompt": "... (Explicitly states 'No background music.')"
      }
    }
  ]
}
```
- `shots` MUST be ordered as delivered; the workflow trusts `shot_index`.
- Every shot must contain storyboard metadata and the three prompts. The response may omit empty dialogue arrays when no dialogue is spoken.
- Gemini may drop or reinvent shots relative to the suggestions but must internally consider the provided guidance before locking the sequence.

## Workflow Behaviour
1. Gather prerequisite artifacts (constitution, scenelets, visual design, audio design). Fail fast when missing.
2. Derive the list of scenelets requiring shot production; throw an error if the target scenelet already has stored shots (shot generation is single-run per scenelet).
3. For each target scenelet:
   - Assemble prompt using the builder.
   - Call Gemini with the combined system prompt.
   - Validate response shape and semantic rules:
     - Scenelet id matches target.
     - Shots array non-empty; indices start at 1 and increment without gaps.
     - Prompt strings trimmed, >= 80 characters, and contain “No background music.”.
     - Dialogue lines exist in scenelet dialogue and character names match visual design.
   - Persist the shot list by inserting each shot; the repository enforces that no prior rows exist for the scenelet.
4. Emit structured logs per scenelet summarizing shot count and notable adjustments (without logging prompt content).

## Error Handling & Observability
- Abort a scenelet on validation or persistence failure and surface actionable errors (missing dialogue, invalid character names, short prompts).
- Safeguard idempotency by rejecting reruns when shots already exist; future tooling may add explicit reset flows.
- Metrics: shots generated per scenelet, average prompt length, Gemini latency per scenelet.

## Reset & Regeneration
- Initial implementation regenerates entire scenelets; future work can add selective overrides. Repository contracts should expose helpers to delete shots by scenelet and to fetch existing rows.
