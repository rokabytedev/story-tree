## 1. Implementation
- [x] 1.1 Extract the standalone player runtime into `agent-backend/src/player/runtime`, add unit tests for the controller API, and wire the standalone template to load the compiled module.
- [x] 1.2 Add an embedded bundle accessor that remaps asset paths to `/generated/<storyId>/…`, surface it through `apps/story-tree-ui/src/server/data`, and ensure `CREATE_PLAYER_BUNDLE` still writes standalone bundles unchanged.
- [x] 1.3 Introduce the Player tab in the Next.js app (sidebar entry, route, server loader) and build React components that render the player using the shared runtime with full-canvas layout.
- [x] 1.4 Share Story Tree design tokens with the standalone template so both embedded and standalone players use the same typography, colors, and spacings.

## 2. Validation
- [x] 2.1 Run `pnpm test --filter player` (new + existing suites) and `pnpm lint` to confirm the shared runtime and UI wiring pass automated checks.
- [ ] 2.2 Manually verify standalone `CREATE_PLAYER_BUNDLE` output and the `/story/{id}/player` route to ensure playback, branching, and theming remain consistent.
