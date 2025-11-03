## Why
Branch selection screens are currently silent, which makes the story confusing for pre-readers. The workflow only synthesizes shot-level dialogue, so children who rely on narrated questions and choices cannot follow branching moments. We need consistent narrator audio for branch prompts without sacrificing the existing timing model.

## What Changes
- Extend the `CREATE_SHOT_AUDIO` workflow task to synthesize narrator audio for each branching scenelet using the stored choice prompt and choice labels.
- Persist the generated branch audio paths alongside scenelets so bundling and playback can resolve the assets.
- Bundle branch audio files into story exports and expose the relative path in the player JSON for branching nodes.
- Update the shared player runtime and embedded player UI to play branch audio after the standard 500 ms grace period while keeping background music running.

## Out of Scope
- Alternate voice casting per branch or per choice.
- Dynamic regeneration of branch audio outside the existing `CREATE_SHOT_AUDIO` modes.
- UI copy changes to the branching overlay beyond wiring audio playback.

## Risks & Mitigations
- **Longer TTS runtimes:** Generating additional audio increases task duration; resume/override handling must mirror shot audio to prevent accidental retries.
- **Asset drift:** Missing files could desync bundles; bundler updates will log and null paths just like shot audio to keep exports resilient.
- **Playback layering:** Playing branch audio while music continues could clash; we will reuse existing volume constants and ensure the player stops branch narration when the user picks a choice.
