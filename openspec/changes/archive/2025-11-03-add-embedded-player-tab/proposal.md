## Why
- The player experience only exists as a standalone HTML bundle today, so the Story Tree UI cannot preview finished stories in situ.
- Branching playback logic and styling live in an inline script/template, making it hard to reuse inside the Next.js workspace or keep visuals aligned with the app theme.
- The current bundle task always copies assets into `/output/stories`, while the UI already serves generated media from `public/generated`. We need an embedded mode that reuses those assets without duplication.

## What Changes
- Add an embedded “Player” tab to the story detail page that fills the main canvas, consumes story bundle data from the backend, and uses the same pause/play branching behavior as the standalone player.
- Extract the standalone player’s runtime into a shared TypeScript module, expose it to both the HTML template and the new React view, and update styling to pull from the Story Tree design tokens.
- Extend the bundle assembly utilities with an embedded accessor that maps asset paths to `public/generated` so the UI can stream existing media without copying files, while keeping `CREATE_PLAYER_BUNDLE` output unchanged.

## Impact
- Frontend: Story sidebar navigation, new player tab route, shared theme tokens, and React player components.
- Backend: Shared player runtime module, embedded bundle accessor, and updated standalone template wiring.
- CLI: `CREATE_PLAYER_BUNDLE` task continues to emit standalone bundles but now sources its runtime script from the shared module.
