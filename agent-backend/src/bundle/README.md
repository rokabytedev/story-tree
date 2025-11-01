# Bundle Module

The bundle module assembles the assets required for the standalone story player. It is intended to
be invoked through the `CREATE_PLAYER_BUNDLE` workflow task and produces a folder that can be
shared independently of the Story Tree workspace.

## Module Overview

- `types.ts` — shared interfaces used across the bundle pipeline.
- `bundleAssembler.ts` — transforms story data into the JSON representation consumed by the player.
- `assetCopier.ts` — copies generated images/audio and the HTML player template into the bundle.
- `playerBundleTask.ts` — workflow wrapper that validates prerequisites and coordinates the steps.
- `templates/player.html` — vanilla HTML/CSS/JS standalone player.

## CLI Usage

```
npm run agent-workflow:cli -- run-task \
  --task CREATE_PLAYER_BUNDLE \
  --story-id <story-id> \
  [--output-path ./output/stories] \
  [--overwrite]
```

- `--output-path` changes the root directory where bundles are emitted. The story id is appended
  automatically.
- `--overwrite` removes an existing bundle directory before regenerating it.

## Output Layout

```
<output-root>/<story-id>/
├── player.html
├── story.json
└── assets/
    └── shots/
        └── <scenelet-id>/
            ├── <shot-index>_key_frame.png
            └── <shot-index>_audio.wav
```

The JSON file contains story metadata, the root scenelet id, and every playable scenelet with its
shots and branching information. Asset paths are referenced relative to the bundle directory so the
folder can be opened offline.
