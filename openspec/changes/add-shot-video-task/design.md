## Overview
We will extend the story workflow with a `CREATE_SHOT_VIDEO` task that generates an 8-second, 16:9, 1080p MP4 preview clip for every storyboard shot. The task mirrors the existing `CREATE_SHOT_IMAGES` flow but calls Gemini Veo 3.1 (`veo-3.1-generate-preview`) and emits video assets. It consumes:

- Visual design document (global aesthetic, character designs, environment designs)
- Shot storyboard payload JSON (framing, actions, referenced designs)
- Existing key frame PNG (when available) for continuity

Outputs are stored under `public/generated/<story-id>/shots/<scenelet-id>/shot-<index>.mp4` and persisted in Supabase via a new `video_file_path` column.

Key references:
- Gemini API Veo video generation (reference images example): [Gemini API docs](https://ai.google.dev/gemini-api/docs/video?example=style#reference-images)
- Internal brief `docs/031_create_video_task_plan.md`

## Prompt Assembly
We will add a `assembleShotVideoPrompt(shot, visualDesignDoc)` helper alongside the existing key frame prompt assembler. It produces a structured payload with the following concatenated sections (each separated by double newlines to improve clarity in text prompts):

1. `global_aesthetic` from the visual design document.
2. Character design descriptions **only** for characters referenced by `storyboardPayload.referencedDesigns.characters`, omitting binary fields such as `character_model_sheet_image_path`.
3. Environment design descriptions filtered likewise, omitting `associated_scenelet_ids` and `environment_reference_image_path`.
4. The exact storyboard payload JSON for the shot.
5. A `critical_instruction` block containing the explicit directives:
   - “Do not include captions, subtitles, or watermarks.”
   - “Do not include background music. Output visuals only.”

The helper returns an object shaped for JSON serialization to keep parity with image prompts; we then `JSON.stringify` it before dispatch.

## Reference Asset Selection
We need deterministic selection of up to three reference images per shot:

1. **P0** – Character model sheets (`character_model_sheet_image_path`) for each referenced character, limited to one image per unique character.
2. **P1** – Environment reference images for each referenced environment, limited to one per environment.
3. **P2** – The shot’s generated key frame image (`keyFrameImagePath`) if it exists.

The selection routine:
- Queries visual design metadata to resolve character/environment assets (falling back to referenced design IDs).
- Loads file paths relative to `public/generated`.
- Builds a prioritized queue, de-duplicating by absolute path, and takes the first three entries.
- Logs (in verbose mode) the selected asset IDs and ensures exactly three entries when possible; if fewer than three assets exist, proceed with the available ones.

For Veo requests we must provide images as binary blobs or GCS URIs. We’ll reuse the `loadReferenceImagesFromPaths` helper and extend it to support `.mp4` output directory lookups but keep the interface returning `{ data: Buffer; mimeType }`. Each entry will be wrapped as a Gemini API `VideoGenerationReferenceImage` with `reference_type: "asset"` per the official reference sample, ensuring up to three asset images guide the clip.

## Gemini Video Integration
We will introduce a `GeminiVideoClient` interface in `agent-backend/src/gemini/types.ts`:

```ts
export interface GeminiVideoClient {
  generateVideo(options: {
    userPrompt: string;
    referenceImages: Array<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' }>;
    model?: string; // defaults to veo-3.1-generate-preview
    aspectRatio?: '16:9' | '9:16' | '1:1';
    resolution?: '720p' | '1080p';
    durationSeconds?: number;
    retry?: GeminiRetryOptions;
  }): Promise<{ videoData: Buffer; mimeType: 'video/mp4' }>;
}
```

Implementation notes:
- Call `models.generate_videos` with `GenerateVideosConfig` populated via `reference_images` and poll the long-running operation using `operations.get` until completion, matching the Gemini API workflow.
- Include each reference image by streaming bytes and setting `reference_type: "asset"` just like the sample.
- Default parameters: aspectRatio `16:9`, resolution `1080p`, duration `8`, and `generate_audio` disabled.
- Accept `retry` settings like other Gemini clients to centralize exponential backoff handling.

We’ll provide a stub video client for CLI stub mode returning a pre-generated MP4 fixture stored under `agent-backend/fixtures/videos/stub-shot.mp4`.

## Task Modes & Flow
`runShotVideoTask(storyId, dependencies)` will be implemented under a new `agent-backend/src/shot-video/` package with:

- `types.ts` defining dependencies (`storiesRepository`, `shotsRepository`, `geminiVideoClient`, `videoStorage`, `logger`, `retry`, `mode`, `targetSceneletId`, `targetShotIndex`, `verbose`, `dryRun`).
- `videoStorage` abstraction mirroring `ImageStorage`, exposing `saveVideo(buffer, storyId, category, filename)`.
- `ShotVideoTaskResult` summarizing `generatedVideos`, `skippedExisting`, `totalShots`.

Processing steps:
1. Load story; require `visualDesignDocument`.
2. Load all shots grouped by scenelet and filter by `targetSceneletId`/`targetShotIndex`.
3. Determine scope based on `mode`:
   - `default`: require shots without `video_file_path`.
   - `resume`: skip shots already having a video path.
   - `override`: regenerate for every targeted shot.
   - `dry-run`: behave like `resume` (skip existing) but short-circuit before Gemini call and storage, logging prompt and reference metadata.
4. For each shot in scope:
   - Parse storyboard payload and ensure `referencedDesigns` present.
   - Assemble prompt and reference images.
   - If `dry-run`, log payload & continue without calling Gemini.
   - Otherwise, invoke `geminiVideoClient.generateVideo`, which issues `models.generate_videos` with the assembled `GenerateVideosConfig`.
   - Persist MP4 via `videoStorage.saveVideo`, storing relative path.
   - Update repository via new `updateShotVideoPath` method.
5. Return summary counts and log success metrics.

Errors encountered per shot should abort the task (consistent with image/audio tasks) but include metadata (scenelet, shot index) in the error message. `dry-run` should surface missing assets (e.g., absent key frame) as warnings rather than failures to help operators diagnose before spending credits.

## CLI & Workflow Wiring
- Extend `StoryWorkflowTask` union, `TASK_SEQUENCE`, and `runAllTasks()` to include `CREATE_SHOT_VIDEO` immediately after `CREATE_SHOT_IMAGES` and before audio.
- `StoryWorkflowImpl.runTask` will branch to `runShotVideoTask`.
- Inject `shotVideoTaskOptions` and `runShotVideoTask` into `AgentWorkflowOptions`.

CLI changes (`agentWorkflowCli`):
- Update the task list and help messaging to include `CREATE_SHOT_VIDEO`.
- Support targeting flags `--scenelet-id`, `--shot-index`, `--override`, `--resume`, plus new `--dry-run` (boolean).
- Wire options into workflow via `shotVideoTaskOptions` with `mode` values `default|resume|override|dry-run`, defaulting to `default`.
- Ensure `--dry-run` is mutually exclusive with `--override` (override implies actual generation).
- In stub mode, configure `geminiVideoClient` to a fixture client and `videoStorage` to write stub MP4s under the generated assets folder.
- Update usage documentation and tests accordingly.

## Storage & Repository Updates
- Supabase migration adding `video_file_path TEXT` (nullable) to `public.shots`.
- Extend repository models (`ShotRecord`, `CreateShotInput`, etc.) with `videoFilePath?: string`.
- Add `updateShotVideoPath(storyId, sceneletId, shotIndex, videoPath: string | null)` that updates only the video column and returns the refreshed shot.
- Add `findShotsMissingVideos` to mirror `findShotsMissingImages`, returning scenelet/shot tuples lacking video.
- Modify `findShotsMissingImages` to optionally reuse shared helper (`buildShotCoverage`).
- Tests covering repository methods and migration.

`videoStorage` in production mode will reuse the file-system storage used for images/audio but write `.mp4` files. We will ensure directories are created and return relative paths (`generated/<story-id>/shots/<scenelet-id>/shot-<index>.mp4`).

## Stub & Testing Strategy
- Provide deterministic MP4 fixtures (2–3 second silent clips) for stub mode and unit tests.
- Add unit tests for prompt assembly, reference selection, dry-run flow, and repository integration.
- Update CLI integration tests to cover resume, override, dry-run, and targeting combinations.

## Open Questions
1. Should dry-run write placeholder entries in Supabase? **Proposal**: no, it should leave existing `video_file_path` untouched to keep the run side-effect free.
2. Do we need to guard against missing key frames? **Proposal**: log warnings and proceed; the spec can later decide whether to enforce.
3. Will videos include audio in the future? If yes, we’ll extend the prompt assembly when the API supports it; current scope keeps silent clips per requirement.
