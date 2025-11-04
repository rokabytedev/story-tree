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
- from audio design document
    - form a `audio_design` json object and insert right before the `storyboard_payload` in the final json to gemini.
    - `sonic_identity.sound_effect_philosophy`. don NOT include `musical_direction` field.
    - `narrator_voice_profile` as a whole, only include if the `storyboard_payload.audioAndNarrative` has narrator line (the `source` field is 'narrator').
    - do NOT include `music_and_ambience_cues`
    - include `character_voice_profiles` but filter to only keep the characters referred in this shot who has a line in `storyboard_payload.audioAndNarrative` (the `source` field matches character id. if source is 'narrator', it's for narrator voice profile, not character voice profile).
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

# download
- gemini video generation returns an operation handle. after waiting for the operation to finish, it will return a download link
- e.g. "Gemini returned a video URI (https://generativelanguage.googleapis.com/v1beta/files/ky9j9o2e8xs4:download?alt=media) instead of inline bytes. Configure the client to request inline data or provide storage integration."
- the client code should handle downloading the file directly to the desired file name. DO NOT request inline data.
- make sure always print the download link to console for debugging, e.g. `https://generativelanguage.googleapis.com/v1beta/files/ky9j9o2e8xs4:download?alt=media`.

also change the gemini video client to support a download only mode, e.g. if
```sh
npm run agent-workflow:cli -- run-task --mode real --verbose --remote --story-id 999c2177-c02b-41e1-bb4d-ec9dff2bb403 --task CREATE_SHOT_VIDEO --scenelet-id scenelet-1 --shot-index 1 --video-download-link "https://generativelanguage.googleapis.com/v1beta/files/ky9j9o2e8xs4:download?alt=media"
```
the flag is provided, then the client will not send request to gemini, but instead only download the existing file from the link directly.
this only applies to single shot video generation request, otherwise, the command will fail.

example code:
```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const prompt = "Panning wide shot of a calico kitten sleeping in the sunshine";

// Step 1: Generate an image with Nano Banana.
const imageResponse = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  prompt: prompt,
});

// Step 2: Generate video with Veo 3.1 using the image.
let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt: prompt,
  image: {
    imageBytes: imageResponse.generatedImages[0].image.imageBytes,
    mimeType: "image/png",
  },
});

// Poll the operation status until the video is ready.
while (!operation.done) {
  console.log("Waiting for video generation to complete...")
  await new Promise((resolve) => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({
    operation: operation,
  });
}

// Download the video.
ai.files.download({
    file: operation.response.generatedVideos[0].video,
    downloadPath: "veo3_with_image_input.mp4",
});
console.log(`Generated video saved to veo3_with_image_input.mp4`);
```

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