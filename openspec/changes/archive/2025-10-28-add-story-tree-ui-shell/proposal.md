# Proposal: Add Story Tree UI Shell

read docs/011_ui_bootstrap_plan.md for more details

## Why
- Story Tree currently lacks a dedicated UI for exploring generated story artifacts; engineers and storytellers rely on raw data dumps.
- Bootstrapping the UI now unblocks future visual features (storyboard, media editors) and keeps pace with backend workflow outputs.
- Establishing theming and layout conventions early prevents design drift and accelerates future milestone work.

## What Changes
- Scaffold a standalone Next.js + React + Tailwind workspace housed outside the backend package tree.
- Implement the Story Tree app shell: left-hand vertical tab navigation, shared theme tokens, and responsive layout matching existing mocks.
- Render placeholder content for constitution markdown, interactive script YAML, visual design JSON, visual reference JSON, and audio design JSON while reserving the storyboard canvas for later.
- Configure URL-based tab routing under `/story` paths with SPA-like navigation and a mocked story index page.
- Add a lightweight UI validation check (Storybook smoke story or Playwright spec) to guard the navigation experience.

## Impact
- Adds a new workspace directory and UI-specific dependencies (Next.js, Tailwind, icon set) to the monorepo tooling.
- Requires updating workspace configuration (npm workspaces or equivalent) and CI lint/build scripts to include the UI package.
- Minimal risk to backend runtime; primary risk is maintaining consistent artifact shapes between UI mocks and workflow APIs.
- Documentation updates needed: new UI README, doc 011 bootstrap plan (already expanded).

## References
- `docs/011_ui_bootstrap_plan.md`
- `ui_mocks/storyboard.png`
- `ui_mocks/storyboard.html`
