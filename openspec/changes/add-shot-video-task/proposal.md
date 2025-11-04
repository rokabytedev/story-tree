## Why
- The workflow only generates still key frames for each storyboard shot, leaving teams without cinematic footage for the player or downstream video exports.
- Gemini Veo 3.1 now supports reference-guided video generation with strict limits on prompt structure and reference asset counts that differ from the existing image flow.
- We need an explicit dry-run pathway to validate prompt assembly and asset wiring because Veo invocations are substantially more expensive than image synthesis.

## What Changes
- Add a `CREATE_SHOT_VIDEO` workflow task that builds Veo 3.1 prompts from storyboard payloads plus filtered visual design context, uploads up to three prioritized reference images (characters → environments → key frames), and persists returned MP4 clips per shot.
- Extend storage, repositories, and schema to track a new `video_file_path` for each shot, expose helpers to find shots missing videos, and update bundle/manifest generation to surface video assets alongside images and audio.
- Update the CLI, workflow wiring, and resume/override plumbing to support the new task, including a `--dry-run` flag that exercises all validation and prompt assembly logic without calling Gemini.
- Provide stub-mode behaviour that saves deterministic placeholder videos so the rest of the pipeline (UI previews) can run without real Veo calls.
- Reflect the new task in specs (story-workflow, story-storage) so downstream implementation and QA have clear requirements.

## Impact
- Introduces a new Gemini API surface (Veo 3.1 video generation) and new runtime dependencies for loading/storing MP4 files.
- Requires Supabase migrations and repository updates, affecting deployments and local dev environments.
- Adds CLI surface area (`--dry-run`, new task) and test coverage requirements across backend, storage, and UI.
