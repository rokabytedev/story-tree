goal
- now that we have character model sheet images and environment reference images. we're going to replace the image path from visual reference package with the new character model sheet images and environment reference images path saved in visual design document directly.
- the path is something like:
`<story-id>/visuals/characters/<character-id>/character-model-sheet.png`
`<story-id>/visuals/environments/<environment-id>/environment-reference.png`
they are saved in the visual design document in character_designs and environment_designs json field.

the logic keeps the same:
- for a shot, find the needed character(s) and environment(s) by id and then find the image paths and upload the image to gemini when generating shot image.
- the only thing different is the image path comes from the new paths saved in the visual design doc directly instead of from visual reference package.
- there is only one single model sheet image per character and one single reference image for a environment. so one image for each is enough. no need to try to find like 5 images. e.g. if there are 2 characters in a scene, there will be 3 images uploaded to gemini as reference: 2 character model sheet images + 1 environment reference image.

the visual reference package will be deprecated later. but it's next step. you can leave the code there without worry about removing. we will do a deprecation clean up later.