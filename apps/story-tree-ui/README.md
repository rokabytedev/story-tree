# Story Tree UI

Story Tree UI is the web front-end for exploring interactive story artifacts produced by the agent workflow. The bootstrap milestone establishes the app shell, shared theme tokens, and placeholder viewers for constitution, script, storyboard, visual, and audio outputs.

## Workspace Setup

The UI lives in its own workspace under `apps/story-tree-ui/`. From the repository root run:

```bash
npm install            # installs root + workspace deps
npm run dev --workspace story-tree-ui
```

The dev server runs at [http://localhost:3000](http://localhost:3000). Because this milestone relies on static mocks, no backend services are required.

## Theme Tokens

Global theme tokens are defined in `src/app/globals.css` and surfaced in `tailwind.config.ts`. Key colors and typography helpers:

- `--color-page`: primary background (`bg-page`)
- `--color-surface`: panel surface (`bg-surface`)
- `--color-border`: divider accents (`border-border`)
- `--color-highlight`: accent gold used for active states (`text-highlight`)
- `--font-geist-sans`, `--font-geist-mono`: supplied via `next/font/local`

Utility components (code block, empty state) rely on these tokens, so update both the CSS variables and Tailwind theme when adjusting the palette.

## Mock Data

Static artifacts live in `src/data/mockStory.ts`:

- `mockStories`: summaries for the `/story` index page
- `mockStory`: detailed constitution/script/visual/audio payloads
- `getStoryArtifacts(storyId)`: helper for tab routes

Replace these mocks with real Supabase fetches once backend APIs are available. The tab pages import from the helper to keep the swap localized.

## Navigation Structure

Routes follow the OpenSpec plan:

- `/story`: story index listing mock cards
- `/story/[storyId]/constitution`: markdown preview
- `/story/[storyId]/script`: YAML viewer
- `/story/[storyId]/storyboard`: storyboard empty state
- `/story/[storyId]/visual`: JSON viewer
- `/story/[storyId]/audio`: JSON viewer

The sidebar lives in `src/components/storySidebar.tsx` and respects URL state via `usePathname()`. On mobile widths, the sidebar renders inline above the canvas content.

## Future Integration Notes

- Replace mock data with Supabase queries once the workflow persists artifacts. Consider `Route Handlers` or `server-actions` to fetch JSON.
- Introduce a Storybook or Playwright smoke spec when the navigation stabilizes.
- Plan for sidebar collapse / responsive tweaks if we target narrow viewports.
- Iconography currently uses inline SVGs to avoid dependency conflicts; swapping for an icon library is straightforward once the stack finalizes.
