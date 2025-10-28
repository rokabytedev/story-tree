# Story Tree UI

Story Tree UI is the web front-end for exploring interactive story artifacts produced by the Story Tree agent workflow. The application now streams live data from Supabase so designers and engineers can inspect real stories without swapping data sources.

## Workspace Setup

The UI lives in its own workspace under `apps/story-tree-ui/`. From the repository root:

```bash
npm install
cp apps/story-tree-ui/.env.local.example apps/story-tree-ui/.env.local
# edit .env.local with your Supabase credentials
npm run dev --workspace story-tree-ui
```

The dev server runs at [http://localhost:3000](http://localhost:3000). All data fetching happens in server components, so the Supabase service role key stays on the server.

## Supabase Configuration

`src/server/supabase.ts` creates a memoized Supabase service client that supports two modes:

- `STORY_TREE_SUPABASE_MODE=local` (default) reads `SUPABASE_LOCAL_URL` and `SUPABASE_LOCAL_SERVICE_ROLE_KEY`.
- `STORY_TREE_SUPABASE_MODE=remote` reads `SUPABASE_REMOTE_URL` and `SUPABASE_REMOTE_SERVICE_ROLE_KEY`.

Both modes fall back to `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` so the UI stays aligned with existing tooling. If the selected mode cannot resolve credentials, the module raises a `SupabaseConfigurationError` and the UI renders an informative empty state.

Copy `.env.local.example` to `.env.local` and fill in the appropriate credentials for your environment. Never commit real service role keys.

## Data Access Layer

The server-side data layer lives in `src/server/data/stories.ts` and reuses the shared Supabase repositories:

- `getStoryList()` powers `/story`, returning summaries (`id`, `title`, `author`, `accentColor`) for the story index.
- `getStory(storyId)` fetches a single story record and normalizes artifact payloads (constitution markdown, visual/audio JSON).
- `getStoryTreeScript(storyId)` loads scenelets, assembles the interactive script snapshot, and returns the YAML view.

All functions default to empty results when artifacts are missing so tabs can render contextual empty states.

## Navigation Structure

Routes follow the OpenSpec plan while fetching real data:

- `/story`: lists stories from Supabase with contextual empty states.
- `/story/[storyId]/constitution`: renders persisted constitution markdown.
- `/story/[storyId]/script`: outputs assembled interactive script YAML.
- `/story/[storyId]/storyboard`: placeholder storyboard canvas.
- `/story/[storyId]/visual`: pretty prints the visual design document JSON.
- `/story/[storyId]/audio`: pretty prints the audio design document JSON.

The sidebar lives in `src/components/storySidebar.tsx` and respects URL state via `usePathname()`. On mobile widths, the sidebar renders inline above the canvas content.

## Theme Tokens

Global theme tokens are defined in `src/app/globals.css` and surfaced in `tailwind.config.ts`. Key colors and typography helpers include:

- `--color-page`: primary background (`bg-page`)
- `--color-surface`: panel surface (`bg-surface`)
- `--color-border`: divider accents (`border-border`)
- `--color-highlight`: accent gold used for active states (`text-highlight`)
- `--font-geist-sans`, `--font-geist-mono`: supplied via `next/font/local`

Utility components (code block, empty state) rely on these tokens, so update both the CSS variables and Tailwind theme when adjusting the palette.

## Future Integration Notes

- Introduce authenticated views or role-based access when exposing the UI beyond trusted environments (service role keys are powerful).
- Add Storybook or Playwright smoke specs once navigation stabilizes and real data flows consistently.
- Plan for sidebar collapse / responsive tweaks if we target narrow viewports.
- Iconography currently uses inline SVGs to avoid dependency conflicts; swapping for an icon library is straightforward once the stack finalizes.
