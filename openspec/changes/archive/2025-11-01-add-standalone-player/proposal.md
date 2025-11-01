# Proposal: Add Standalone HTML Player

## Why

Users need a way to share and play generated interactive storybooks independently without requiring the Story Tree UI workspace, backend services, or internet connectivity. Currently, stories exist only in the database and can be viewed in the storyboard visualization, but there's no playback mechanism for the complete interactive narrative experience with images, audio, and branching choices.

This proposal adds a standalone HTML player that can be bundled with story assets into a self-contained folder for offline playback and easy distribution.

## What Changes

- Add a new `story-player` capability that defines a standalone HTML player
  - Player renders shots sequentially with images and synchronized audio playback
  - Player handles branching points with visual choice UI (question + thumbnail previews)
  - Player includes start screen, auto-play logic, and restart functionality for terminal nodes
  - Player loads story metadata from a JSON file via URL parameter or embedded data
- Add bundle generation task to `story-workflow` capability
  - New `CREATE_PLAYER_BUNDLE` workflow task that assembles story metadata JSON
  - JSON schema represents story tree structure with scenelets, shots, and branching points
  - Bundle task copies generated assets (images, audio) to organized output directory
  - CLI support for bundle generation with story targeting
- Output structure: `/output/stories/<story-id>/` containing:
  - `player.html` - Standalone player page (reusable across stories)
  - `story.json` - Story metadata with relative asset paths
  - `assets/shots/<scenelet-id>/<shot-index>_key_frame.png` - Shot images
  - `assets/shots/<scenelet-id>/<shot-index>_audio.wav` - Shot audio files
- Bundle can be zipped and shared for offline playback on any device with a web browser

## Impact

- Affected specs:
  - **NEW**: `story-player` - New capability for standalone player
  - **MODIFIED**: `story-workflow` - Add bundle generation task
- Affected code:
  - `agent-backend/src/workflow/` - Add bundle task implementation
  - `agent-backend/src/bundle/` - New module for JSON schema and asset copying
  - `apps/story-tree-ui/public/player.html` - New standalone player HTML template
  - `apps/story-tree-ui/public/player.js` - Player logic (vanilla JS, no framework dependencies)
- No changes to:
  - Existing `story-ui` storyboard visualization
  - Database schema
  - Story generation workflow tasks
