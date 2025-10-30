when generating images for shots production, should upload to gemini the reference image.
the code should get all the necessary characters and environments in that shot. and upload one reference image for each of the characters and environments.
character image:
- the one with name like visuals/characters/cosmo/character-model-sheet-1.png. look for `character-model-sheet`. that's the best reference image for shot generation.
environment image:
- find the image of the `keyframe_1` if exits.
prefer including character images if already more than the limit. environment image is optional in that case.

when design, make it flexible. don't hard code the image value where it is used.
separate it to parts:
- the part that "recommend" the reference images. we may change the heuristic later
- the part that takes the reference images and use them in generation (by uploading to gemini when request).

