## Why
Introduce an audio design workflow task so every story gains a cohesive sonic bible once the upstream constitution, interactive script, and visual design are complete.

## What Changes
- Add a `CREATE_AUDIO_DESIGN` task that assembles the Gemini prompt from constitution, story tree YAML, and visual design, validates the response, and saves it to the story record.
- Build prompt builder and response validator modules with coverage that enforces character name and scenelet id integrity.
- Extend workflow CLI and stub fixtures so the audio task runs individually or via `run-all` in both real and stub modes without validation errors.

## Impact
- New workflow logic, repository writes, and CLI wiring.
- Gemini fixtures and tests ensuring audio validation stays aligned with visual design and story tree data.
- Enables downstream tooling to rely on a persisted `audio_design_document`.
