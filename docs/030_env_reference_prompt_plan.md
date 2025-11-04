# goal
- when creating images, use **user prompt** to guide gemini image generation instead of **system prompt**.
- why? gemini image generation doesn't follow system prompt very well.

# requirements
- create environment reference image task
    - in user prompt, before the json payloads, prepend the exact content of `system_prompts/create_environment_reference_image.md`
    - note the difference is that it is NOT system prompt but part of the user prompt.
    - leave empty space between the create_environment_reference_image content and the json payload as separator.
- create shot image task
    - right now, it is using `system_prompts/create_shot_images.md` as **system prompt**.
    - change it to also be prepending the content as the user prompt. same as above.