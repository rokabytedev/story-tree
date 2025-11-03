## Why
Our current shot production system generates three separate prompts per shot (first_frame, key_frame, video_clip) through a "middleman" generation step, losing fidelity from the original storyboard artifacts. The generated prompts may drift from the rich, detailed storyboard_entry metadata that Gemini produces. Additionally, we're storing unnecessary prompt fields that will be deprecated. We need to eliminate this middleman layer and instead assemble image generation prompts directly from the storyboard artifacts, visual design, and audio design documents, ensuring maximum fidelity.

## What Changes
- **Note**: The shot production system prompt (`system_prompts/create_shot_production.md`) has already been updated to generate the new output format with `audio_and_narrative` and `referenced_designs` fields. Do not modify this file.
- Update shot production parsing and validation logic to handle the new `storyboard_entry` structure with `audio_and_narrative` (containing narrator monologue and character dialogue) and `referenced_designs` fields.
- Deprecate the `first_frame_prompt`, `key_frame_prompt`, `video_clip_prompt`, and `first_frame_image_path` database columns and related code paths. Only `key_frame_image_path` will remain.
- Introduce a new prompt assembly method for key frame image generation that:
  - Pulls `global_aesthetic` (visual_style + master_color_palette) from the visual design document
  - Filters `character_designs` and `environment_designs` to include only those referenced in the shot's `referencedDesigns` field
  - Includes the entirety of the `storyboard_payload` except for `audio_and_narrative` (to prevent accidental caption generation)
- Keep the existing create_shot_images.md system prompt and reference image handling unchanged.
- Update the database schema to remove deprecated prompt columns and persist the full `storyboard_payload` including the new fields.

## Impact
- Eliminates the "middleman" prompt generation step, improving fidelity between shot direction and final image generation.
- Deprecates first frame image generation entirely; only key frame images will be generated going forward.
- Breaks backward compatibility with existing shot records that rely on the deprecated prompt and first frame image path fields.
- Requires database migration to drop old columns; existing shots may need regeneration.
- Simplifies the shot-to-image workflow by using structured storyboard data directly rather than pre-generated prompt strings.
- The new `audio_and_narrative` structure provides better control over narration vs dialogue, essential for pacing control.
