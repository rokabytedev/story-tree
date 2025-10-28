# Tasks

1. [ ] Scaffold `apps/story-tree-ui/` with Next.js, TypeScript, Tailwind, linting, and workspace wiring (Validation: `npm run lint --workspace story-tree-ui` succeeds).
2. [ ] Implement shared theme tokens and global styles, including typography and palette applied to the app shell (Validation: visual review + lint).
3. [ ] Build left sidebar navigation with icons, keyboard focus states, and active-state styling wired to mock tab state (Validation: Storybook/Playwright smoke check renders all tabs clickable).
4. [ ] Implement tab canvas pages showing placeholder constitution markdown, script YAML, storyboard empty-state, visual JSON, and audio JSON fed from mocked data (Validation: manual QA in dev server + smoke test).
5. [ ] Add `/story` index page with mock story tiles and client-side navigation to `/story/[storyId]/[tab]` routes (Validation: Playwright/Storybook ensures routing updates URL without full reload).
6. [ ] Document workspace usage, theme tokens, and follow-up integration notes in `apps/story-tree-ui/README.md` (Validation: README reviewed, lint passes).
