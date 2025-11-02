## Why
Background music playback is currently unsupported in the story player, leaving narration-only audio and creating abrupt transitions between scenelets.

## What Changes
- Load and bundle per-story background music assets from `public/generated/<story-id>/music/` alongside existing story resources.
- Map `music_and_ambience_cues` data to scenelets so the player starts, continues, or transitions music in sync with scene changes.
- Add configurable constants for music volume and cross-fade duration, defaulting to balanced levels.
- Warn when cue scenelet coverage is non-consecutive or referenced files are missing, while keeping bundle generation resilient.

## Impact
- Enhances story immersion with continuous music across scenes.
- Requires updates to player asset loading, playback state management, and audio mixing.
- Introduces new configuration points for audio balancing but no UI changes.
