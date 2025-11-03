## Overview
- Introduce a shared player runtime (state machine + timing) implemented in TypeScript under `agent-backend/src/player/runtime`.
- Reuse the runtime from two surfaces: (1) the existing standalone HTML bundle (loaded via a compiled UMD/ES module) and (2) a new React-based player view inside `apps/story-tree-ui`.
- Serve embedded player data via a backend accessor that wraps `assembleBundleJson`, remapping asset paths to `/generated/<storyId>/…` so the UI consumes files already produced during shot generation.

## Considerations
- **Runtime extraction:** The inline script currently owns playback, branching, timers, and DOM updates. We must factor these into pure functions and event emitters so React can drive UI state without duplicating logic.
- **Asset path strategy:** Standalone bundles expect copied assets under `assets/`. Embedding should instead resolve against `apps/story-tree-ui/public/generated`, so we need a parameterized manifest builder and a way to expose resolved URLs to the UI.
- **Styling + theming:** The Next.js workspace already defines Tailwind tokens (e.g., `bg-page`, `text-text-primary`). The standalone HTML must import an equivalent token map (generated CSS variables) to stay visually consistent while remaining self-contained.
- **Music cues:** Bundle assembly can attach optional music assets. The embedded accessor must surface cue metadata while leaving the actual file hosting under `/generated/<storyId>/music`. React UI can defer playback UX until background music ships, but the data contract should handle it.
- **Progressive enhancement:** The React player should render a basic “start” screen even if JavaScript fails, mirroring the standalone experience. Hydration should upgrade controls without breaking when assets are missing.

## Decisions
- Extract a headless controller that exposes imperative methods (`start`, `play`, `pause`, `chooseBranch`, `restart`) and emits typed events so both HTML and React layers attach their own view bindings.
- Build an `createEmbeddedAssetManifest(storyId, shots)` helper that reuses the existing manifest shape but rewrites `imagePath`/`audioPath` to `/generated/<storyId>/…`; pass this to `assembleBundleJson` for React consumption.
- Publish the compiled runtime (`dist/player-runtime.js`) during `CREATE_PLAYER_BUNDLE`, ensuring the HTML template loads it via `<script type="module">`, while Next.js imports the TypeScript source directly.
- Mirror design tokens by exporting CSS variables from `apps/story-tree-ui` (already generated for Tailwind) into a small stylesheet the standalone template can embed, keeping typography and spacing aligned.
