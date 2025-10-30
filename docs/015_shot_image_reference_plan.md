when generating images for shots production, should upload to gemini the reference image.
the code should get all the necessary characters and environments in that shot. and upload one reference image for each of the characters and environments.
character image:
- the one with name like visuals/characters/cosmo/character-model-sheet-1.png. look for `character-model-sheet`. that's the best reference image for shot generation.
environment image:
- find the image of the `keyframe_1` if exits.
prefer including character images if already more than the limit. environment image is optional in that case.
make sure for --verbose mode, print to console the details of which reference images (include the paths) are used for gemini upload.

when design, make it flexible. don't hard code the image value where it is used.
separate it to parts:
- the part that "recommend" the reference images. we may change the heuristic later
- the part that takes the reference images and use them in generation (by uploading to gemini when request).

to find characters and environments, the shot json object has the field `referenced_designs`:
```json
{
  "scenelet_id": "scenelet-3",
  "shots": [
    {
      "shot_index": 1,
      "storyboard_entry": {
        "referenced_designs": {
            "characters": [
            "character-1-id",
            "character-2-id"
            ],
            "environments": [
            "environment-1-id",
            "environment-2-id"
            ]
        },
        "framing_and_angle": "Describe the shot type and camera angle (e.g., 'Wide Establishing Shot from low angle').",
        "composition_and_content": "Describe subject placement, background elements, props, and depth cues.",
        "character_action_and_emotion": "Describe physical beats and emotional read for each on-screen character.",
        "dialogue": [
          { "character": "Exact Character Name", "line": "Exact dialogue line from the scenelet." }
        ],
        "camera_dynamics": "Describe camera movement or confirm it is static.",
        "lighting_and_atmosphere": "Describe lighting quality, color palette, mood, volumetric effects, etc.",
        "continuity_notes": "Describe continuity callouts connecting to preceding/following shots."
      },
      "generation_prompts": {
        "first_frame_prompt": "Self-contained, highly detailed description of the literal starting frame.",
        "key_frame_storyboard_prompt": "Self-contained, highly detailed description of the emotional/key frame.",
        "video_clip_prompt": "Self-contained, highly detailed description of the full motion clip, including camera motion, character performance, diegetic SFX, exact dialogue delivery with voice profile, and the explicit phrase 'No background music.'"
      }
    }
  ]
}
```
right now, the `referenced_designs` field doesn't seem to be persisted in db yet (this is a new change). make the code change to make sure everything in `storyboard_entry` including `referenced_designs` is saved to db. this change is a prerequisite for the lookup to be successful.