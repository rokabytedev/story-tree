problem:
- reference image style drift

goal:
- use structured image generation prompt to solve the style drift issue

requirement:
- separate character model sheet reference image generation to its own task, e.g. CREATE_CHARACTER_MODEL_SHEET_REFERENCE_IMAGE (or something like that, probably too long..)
- this is an image generation task.
- it can be invoked from cli. but it will be called from the web app ui in the future. so design it as a general task like other tasks. cli is just a thin client.
- the task support generating model sheet reference image in two modes:
    - generate image for all characters of a given story-id
        - support --resume flag - only generate image for characters without model sheet image yet.
    - generate a single image for a single character (identified by id) for a given story-id
- the task support a --override flag (can be passed from cli).
    - if --override=false: do nothing if the image for a character already exists.
    - if --override=true: replace the old image with new one even it already exists.

the image generation has the following requirements:
- aspect ratio must be 1:1
- use the same gemini image client. do not reinvent new one
- no system prompt
- use the following prompt:
```
Character model sheet, character design sheet, concept art for animation, professional production art.
A 3-row grid layout.
**Top row:** Full body character turnaround in a T-pose. Clean orthographic views showing front, left side, right side, and back.
**Middle row:** Four headshots demonstrating key facial expressions: neutral, happy, sad, angry.
**Bottom row:** Four dynamic action poses: a ready stance, a walking pose, a running pose, and a jumping pose.
**Style:** Clean digital painting, detailed character render, full color, clear lines.
**Lighting & Background:** Bright, even studio lighting with soft shadows, set against a solid neutral gray background for maximum clarity.
**Constraint:** The image must not contain any text, letters, numbers, annotations, or watermarks. Purely visual with no typography.

{
    // the entire `global_aesthetic` json field from visual design document
    // simply copy-paste here. do not change.
    "global_aesthetic": {
        "visual_style": {...}
        "master_color_palette": [...]
    },
    character_design: {
        // copy-paste the single character design json object from the `character_designs` field from the visual design document.
    }
}
```

the json block at the bottom of the prompt needs to be inserted with the exact values extracted from the visual design document json for this character.
the code should handle getting that data and insert in the prompt before sending to gemini for image generation.

the generated image should be saved in:
`apps/story-tree-ui/public/generated/<story-id>/visuals/characters/<character-id>/character-model-sheet.png`
note: no sequence number at the end.

your task
- expand this doc into detailed openspec spec doc + design doc + other docs
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.
