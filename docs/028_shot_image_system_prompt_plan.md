# goal
- use system prompt for shot image generation gemini request
- to better control the image generation

# requirements
- use the `system_prompts/visual_renderer.md` content as is for the system prompt for shot image generation gemini request.
- don't use it for other image generation request. just the shot image generation.
- the user prompt part stays the same. the only change needed for the user prompt is to redact the `associated_scenelet_ids` field from the `environment_designs[]` because it doesn't provide any useful information gemini and it's confusing.
- in verbose print, make the gemini raw request include the system prompt so that i can verify it is included in the gemini request.

# reliability
- i was using this command to generate images:
```sh
npm run agent-workflow:cli -- run-task --mode real --verbose --remote --story-id 8f87d2c0-e9fd-442d-aff2-a63a70036ee1 --task CREATE_SHOT_IMAGES --resume     
```
but it often fails due to gemini error (e.g. no image in response, invalid gemini response etc - gemini ai generation behavior can be random sometimes) which should be retried using the existing retry infra.
