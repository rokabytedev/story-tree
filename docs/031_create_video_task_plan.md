# goal
- create a new task CREATE_SHOT_VIDEO to support creating videos of the storybook
- create one video per shot.

# inputs to the task
the assemble the video generation prompt:

text prompt:
concat the following with spacing in between:
(similar to what create shot image task does)
- from visual design document
    - the entire `global_aesthetic` field
    - the entire `character_designs` field
        - filtered to keep only the characters referenced in the current shot
        - remove unneeded fields: `character_model_sheet_image_path`
    - the entire `environment_designs` field filtered to keep only the environments referenced in the current shot
        - remove unneeded fields: `associated_scenelet_ids` and `environment_reference_image_path`
- from the shot
    - the entire storyboard payload json of the current shot.
- **critical instruction for video generation**
    - must not include caption/subtitle/watermark
    - must not include background music

upload reference images with the prompt (up to 3 images)
- P0: referenced characters model sheet images (1 per character)
- P1: referenced environment reference images (1 per environment)
- P3: pre-generated image key frame (0 or more depending on if the 3 quota is met)
- always try to upload 3 reference images. use the above priority to decide which to include.

# gemini video api
- use the latest veo 3.1 model (see https://ai.google.dev/gemini-api/docs/video?example=style#javascript_2)
    - model version: `veo-3.1-generate-preview`
- use the reference images capability for video generation (see https://ai.google.dev/gemini-api/docs/video?example=style#reference-images)

# output
- aspect ratio: "16:9"
- resolution: "1080p"
- duration seconds: "8"

# task, workflow, cli
- follow similar pattern as create shot image. need to implement on all layers, task, workflow, cli etc.
- support default (skip if exists), resume (continue with what left), override (redo existing), dry-run (do everything but stops right at the real gemini generation. dry-run is needed is because gemini video generation is really expensive. i want to verify everything works fine before real video generation) modes, 
    - similar to create shot image (except dry-run mode is new)
- support filter by scenelet-id (generate all shots), and/or shot-index (generate one single video for that shot)

your task
- carefully research current logic, code, status quo of the related code base
- carefully read https://ai.google.dev/gemini-api/docs/video?example=style#javascript_2 to understand how to use gemini video (veo 3.1) api
- expand this doc into detailed openspec spec doc + design doc + other docs
    - detailed design doc with all the details you get from this document and the https://ai.google.dev/gemini-api/docs/video?example=style#reference-images document.
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.