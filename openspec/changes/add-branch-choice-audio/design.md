# Overview
Branch points currently freeze the player with no narration. We will extend the existing audio generation, storage, bundling, and playback layers so every branching scenelet has a synthesized narrator clip that reads the question and the available choices. The design keeps the current 500 ms ramp-up timing, reuses the narrator voice profile, and ensures background music keeps looping while users consider options.

## Audio Asset Storage
Branch narration belongs to the source scenelet that triggers the branch. We need a stable location in `apps/story-tree-ui/public/generated` and a way to persist the relative path.

### Option A — reuse shots directory
Store branch narration next to shot audio (e.g. `shots/<scenelet-id>/branch_audio.wav`). This keeps assets together but mixes numbered shot files with non-shot audio and complicates bundle manifests that assume shot indices.

### Option B — dedicated branches directory *(chosen)*
Store branch narration under `branches/<scenelet-id>/branch_audio.wav`. This keeps a single WAV per branch point, avoids naming collisions with numbered shots, and mirrors directly into the bundle as `assets/branches/<scenelet-id>/branch_audio.wav`. We will persist the relative path (`generated/<story-id>/branches/<scenelet-id>/branch_audio.wav`) on the scenelet record.

We will add a nullable `branch_audio_file_path` column to `public.scenelets`, expose it through the scenelets repository, and provide an `updateBranchAudioPath` helper so workflow tasks can set or clear the value.

## Workflow Updates
### Branch discovery
When `CREATE_SHOT_AUDIO` runs we already load the story record, audio design document, and shots by scenelet. We will also load scenelets so we can locate those marked `isBranchPoint === true`. For each branch point we will:
1. Read its `choicePrompt`.
2. Gather choice labels from child scenelets (`choiceLabelFromParent`) ordered by creation/scenelet sequence.
3. Skip generation when prompt or two or more choice labels are missing, logging a warning and storing the skipped placeholder (`N/A`).

### Prompt assembly
Branch narration always uses a single narrator voice. We will add a `buildBranchAudioScript(scenelet, choices)` helper that returns a plain text script:
- Start with the trimmed choice prompt followed by an inquisitive cue (e.g., “?” already part of prompt).
- Introduce each choice on a new sentence: `"First choice label."`, `"Or second choice label."`. For three or more choices we will join with commas and a final "or" per English conventions.
- Capture a short delivery cue ("In an inviting narrator tone...") via a constant so we can hint at pacing without polluting spoken lines.

We will add a `assembleBranchAudioPrompt(audioDesign)` helper that formats a JSON payload similar to shot prompts but limited to two entries: one with `{ narrator_voice_profile }` and another with `{ script: { line, delivery } }`. The Gemini request will always use single-speaker mode with the narrator `voice_name` and omit speaker analysis.

### Mode semantics
Branch audio generation will respect the existing mode flags:
- **default**: throw if any targeted branch already has audio (path not null and not `N/A`).
- **resume**: skip branches with existing audio paths.
- **override**: regenerate and overwrite files/paths for all targeted branches.

The task result counters will include branch clips so operators can see how many audios were generated or skipped. We will persist `SKIPPED_AUDIO_PLACEHOLDER` for branches we intentionally skip so resume mode keeps bypassing them.

### File storage
We will extend the audio file storage adapter with `saveBranchAudio({ storyId, sceneletId, audioData })`, writing to `generated/<story-id>/branches/<scenelet-id>/branch_audio.wav`. This mirrors the shot helper and allows future storage backends to support both methods.

## Bundle & Asset Copier
The bundle assembler will read `branch_audio_file_path` for each scenelet. When present (and not `N/A`) it will normalize the path and expose it as `branchAudioPath` on the corresponding `SceneletNode`. Only branching scenelets will have a value; others remain `null`.

The asset copier will be updated to:
- copy branch audio files from `public/generated/<story-id>/branches/<scenelet-id>/branch_audio.wav` into `/output/stories/<story-id>/assets/branches/<scenelet-id>/branch_audio.wav` when the source exists;
- log a warning and null the bundle path when the source is missing, matching the existing shot behavior.

The embedded bundle manifest loader will also surface these paths so the workspace player can access them without requiring the full export.

## Player Runtime & UI
We will extend the shared runtime with a new `branch-audio` event that fires when a branch enters.
- After `RAMP_UP_MS` (500 ms) the runtime emits `{ type: 'branch-audio', sceneletId, audioPath }` if `branchAudioPath` is set.
- The runtime keeps the stage at `choice` and will not schedule auto-advance; it simply informs the UI that narration can play once.
- When the user picks a branch or the controller restarts, the runtime emits a `branch-audio-stop` event so the UI can halt playback immediately.

In the embedded player the existing shot audio element can be reused:
- Listen for the new event, set the audio source, and play without affecting the pause state.
- Reuse the 500 ms delay via `setTimeout` so audio honors the grace period.
- On pause/resume toggles triggered by the toolbar we will pause/resume branch audio similar to shot audio.

To satisfy “music should continue playing,” the UI will skip `pauseBackgroundMusic()` when the stage is `choice`; the music controller keeps looping cues while narration plays.

## Telemetry & Logging
- Shot audio task logs will include separate counters for `generatedShotAudio` and `generatedBranchAudio` for operator clarity.
- Warnings for missing prompts or labels will identify the scenelet id so pipelines can be fixed upstream.

## Assumptions & Follow-ups
- Branching scenelets always have at least two child choices; if more exist we narrate all of them, joining with commas and an "or" before the final option.
- The narrator voice profile is always present in the audio design document; if missing we fail the task just like shot narration.
- We keep spoken copy simple rather than attempting SSML—Gemini 2.5 previews do not yet accept SSML in this workflow.
