problem:
- reference image style drift

goal:
- use structured image generation prompt to solve the style drift issue
- we have done this for character model sheet before. now it's turn for environment reference images.
    - you can refer to character model sheet task CREATE_CHARACTER_MODEL_SHEETS for reference

requirement:
- separate environment reference image generation to its own task, e.g. CREATE_ENVIRONMENT_REFERENCE_IMAGE (something like, you can decide the name of the task)
- this is an image generation task.
- it can be invoked from cli. but it will be called from the web app ui in the future. so design it as a general task like other tasks. cli is just a thin client.
- the task support generating environment reference image in two modes:
    - batch mode: generate image for all environments of a given story-id
        - support --resume flag - only generate image for environments without model sheet image yet.
    - single mode: generate a single image for a single environment (identified by id) for a given story-id
- the task support a --override flag (can be passed from cli).
    - if --override=false: do nothing if the image for a environment already exists.
    - if --override=true: replace the old image with new one even it already exists.

the image generation has the following requirements:
- aspect ratio must be 16:9 (the default aspect ratio)
- use the same gemini image client. do not reinvent new one
- no system prompt
- use the following prompt (must use this exact prompt. copy it to the openspec design doc. do not invent another value):
```
# Role: Environment Concept Artist

Your purpose is to generate high-fidelity environment reference images for film, animation, and game production. The output must serve as a precise visual guide for a specific scene.

# Core Directive: Strict Adherence to the User's Prompt

Your most critical function is to create an image that is a direct and literal visualization of the user's request.

*   **Analyze:** Deconstruct the user's prompt to identify every specified element: objects, lighting, atmosphere, color palette, camera angle, and composition.
*   **Construct:** Build the scene using *only* the elements explicitly mentioned.
*   **Omit:** Do not add, invent, or infer any objects, characters, animals, or environmental details that are not described in the prompt. Your role is to be a precise tool, not an interpretive artist.

{
    // the entire `global_aesthetic` json field from visual design document
    // simply copy-paste here. do not change.
    "global_aesthetic": {
        "visual_style": {...}
        "master_color_palette": [...]
    },
    environment_design: {
        // copy-paste, without changing anything, the fields from the `environment_designs` from the visual design document for the given environment id:
        "environment_id": "",
        "detailed_description": {
            "color_tones": "",
            "key_elements": "",
            "overall_description": "",
            "lighting_and_atmosphere": ""
        },
    }
}
```

the json block at the bottom of the prompt needs to be inserted with the exact values extracted from the visual design document json for this environment.
the code should handle getting that data and insert in the prompt before sending to gemini for image generation.

the generated image should be saved in:
`apps/story-tree-ui/public/generated/<story-id>/visuals/environments/<environment-id>/environment-reference.png`
note: no sequence number at the end.
the saved file path should be persisted into db in the visual design doc json, under `environment_designs` -> the environment object, adding a new field called: `environment_reference_image_path`. this field will be used to: fetch the image url for the web app ui, determine if model sheet image already generated for a environment, etc.
no db schema change is needed since this is just a json schema update.
the path should be saved to db immediately after the image is generated successfully (this is important for the batch mode generation, so that the db won't be out of sync by too much with the actual generated images when multiple images are generated in a batch).

your task:
- expand this doc into detailed openspec spec doc + design doc + other docs
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.
