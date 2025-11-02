# Implementation Tasks

1. [x] Extend `agent-backend/src/bundle/types.ts` and `bundleAssembler.ts` so the story bundle includes background-music cue metadata keyed by scenelet IDs, logging warnings for non-consecutive associations; cover with new cases in `agent-backend/test/bundleAssembler.test.ts`.
2. [x] Update `agent-backend/src/bundle/assetCopier.ts` to copy `.m4a` cue files into the story bundle (e.g. `assets/music/<cue>.m4a`) and flag missing files without failing the task; add filesystem-focused coverage similar to existing asset copier tests.
3. [x] Teach `agent-backend/src/bundle/templates/player.html` to load the cue manifest, expose configurable constants for music volume and cross-fade duration, and maintain playback continuity while scenelets stay within the same cue.
4. [x] Implement cross-fade transitions and missing-asset fallbacks in the player runtime, including console warnings when cue audio is absent or associations break continuity; verify via a jsdom-based player script test or documented manual QA instructions.
