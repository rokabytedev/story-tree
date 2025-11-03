# Branch Narration Audio Runbook

Branch prompts now include narrated audio so pre-readers can follow the question and available choices. This runbook captures how the new assets flow through storage, bundling, and playback so developers can operate the pipeline end-to-end.

## Storage & Asset Layout

- Supabase scenelets now persist `branch_audio_file_path`. The path is relative to `apps/story-tree-ui/public` and uses the template  
  `generated/<story-id>/branches/<scenelet-id>/branch_audio.wav`.
- `CREATE_SHOT_AUDIO` writes the WAV file through `saveBranchAudio`, which mirrors the shot helper but targets the `branches/` folder.
- The bundle assembler attaches `branchAudioPath` to branching scenelets in both the export bundle and the embedded workspace manifest.
- The asset copier mirrors branch audio into the export at  
  `output/stories/<story-id>/assets/branches/<scenelet-id>/branch_audio.wav`, logging (and nulling) the path if the source file is missing.

## Workflow Behavior

`CREATE_SHOT_AUDIO` now handles both shot and branch narration. The task:

- Loads branching scenelets, assembles a narrator script from the scenelet prompt plus child choice labels, and calls Gemini TTS in single-speaker mode.
- Respects existing mode flags:
  - `default`: fails if narrated audio already exists for a targeted branch.
  - `resume`: skips branch points that already have a stored path or were previously marked with the skip placeholder.
  - `override`: regenerates narration for every targeted branch and overwrites existing files.
- Persists `branch_audio_file_path` (or the skip placeholder) through the Supabase repository, keeping shot and branch counters in task logs so operators can confirm how many clips were produced.

### Running the Task

```
npm run agent-workflow:cli -- run-task \
  --task CREATE_SHOT_AUDIO \
  --story-id <story-id> \
  [--scenelet-id <branch-scenelet>] \
  [--resume | --override]
```

Branch narration files are written alongside shot audio during the run. After generation, confirm that `apps/story-tree-ui/public/generated/<story-id>/branches/` contains one WAV per branching scenelet.

## Player & UI Expectations

- The shared runtime emits `branch-audio` 500 ms after entering a branch stage (and `branch-audio-stop` when the scenelet changes or playback restarts).
- The embedded player reuses the primary narration `<audio>` element for branch narration, clears the source on stop/restart, and leaves background music running while choices are displayed.
- Regression coverage lives in:
  - `agent-backend/test/playerRuntimeController.test.ts`
  - `apps/story-tree-ui/src/components/player/embeddedPlayer.test.tsx`

## Validation Checklist

1. Apply the Supabase migration `000009_add_scenelets_branch_audio_path.sql`.
2. Generate or stub a story and run `CREATE_SHOT_AUDIO` (see command above).
3. Build an export to confirm bundles include branch audio under `assets/branches/`.
4. Run automated checks:
   - `npm test`
   - `openspec validate add-branch-choice-audio --strict`

## Troubleshooting

- **Missing prompt or choice labels**: The task logs `Skipping branch audio generation` and records the skip placeholder so `--resume` does not continually retry. Fix upstream data and rerun with `--override` once ready.
- **Asset copier warnings**: Check that workstation assets were generated under `apps/story-tree-ui/public/generated/.../branches/` before running export tasks.
- **Playback silence**: Verify the manifest contains `branchAudioPath` for the scenelet and confirm the embedded player test suite passes—those tests exercise branch narration playback, stop behavior, and music continuity.
