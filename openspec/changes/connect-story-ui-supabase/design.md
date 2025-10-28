# Design: Connect Story Tree UI to Supabase

## Overview
The Story Tree UI currently renders mock data. This change introduces a server-side data layer that queries Supabase so designers and engineers can inspect real stories. We will reuse the shared Supabase repositories, expose deterministic view models for the UI, and support both local and remote stacks through environment-based configuration. All data fetching stays in server components to keep service role secrets out of the browser bundle.

## Supabase Connection Strategy
- Create `server/supabase/client.ts` (marked with `"server-only"`) to centralize credential resolution and instantiate a singleton Supabase service client.
- Accept a `STORY_TREE_SUPABASE_MODE` env var (`local` default, `remote` optional). The resolver will mirror CLI precedence:
  - `local`: `SUPABASE_LOCAL_URL` → `SUPABASE_URL`; `SUPABASE_LOCAL_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
  - `remote`: `SUPABASE_REMOTE_URL`; `SUPABASE_REMOTE_SERVICE_ROLE_KEY`
  - Allow per-process overrides via `STORY_TREE_SUPABASE_URL` / `STORY_TREE_SUPABASE_SERVICE_ROLE_KEY` for ad-hoc debugging.
- Throw a descriptive `SupabaseUiConfigurationError` when credentials are missing so the UI can render an actionable empty state.
- Export cached repository factories (`getStoriesRepository`, `getSceneletsRepository`) that always reuse the same Supabase client for the current request lifecycle.
- All server-only utilities live under `apps/story-tree-ui/server/` so UI components (`apps/story-tree-ui/src/`) only import through this boundary.

## Data Access Layer
- New module `server/data/storyData.ts` exposes async helpers:
  - `fetchStorySummaries()` → array of `{ id, title, accentColor }`
  - `fetchStoryDetail(storyId)` → `{ summary, constitutionMarkdown?, scriptYaml?, visualDesign?, audioDesign?, visualReference?, prompt }`
  - `fetchStoryTreeYaml(storyId)` that wraps `loadStoryTreeSnapshot` from `agent-backend/story-storage`.
- Use `cache()` from `react` to memoize fetches per request to avoid duplicate Supabase queries when multiple tabs render on the same page.
- Supabase access helpers live under `server/supabase/` and reuse repository factories imported from the shared `supabase` package (no duplicate data access logic).
- Deterministic accent color generation: hash story id into palette (fallback palette constant). Author name remains `"Story Tree Agent"` until author metadata lands in Supabase.

## Story Index Rendering
- `app/story/page.tsx` becomes an async server component that calls `fetchStorySummaries()`.
- If the resolver throws a configuration error or Supabase returns zero stories, render an updated empty state describing how to seed the database or configure credentials.
- Replace `mockStory` references with fetched summaries; maintain existing styling.

## Story Detail Tabs
- Remove `mockStory.ts` consumption; Story layout now calls `fetchStoryDetail` to provide `summary` and pass story metadata to children.
- Constitution tab:
  - Render markdown when `story.storyConstitutionMarkdown` exists; otherwise show empty state message referencing missing artifact.
- Script tab:
  - Call `fetchStoryTreeYaml`. On success render YAML via existing `MarkdownPreview` replacement (or code block); on `StoryTreeAssemblyError` render error prompt to check scenelets.
  - Use `loadStoryTreeSnapshot` to build YAML (server-only module).
- Visual / Audio tabs:
  - Display pretty-printed JSON using current JSON viewer (update component to handle empty state when payload missing).
- Storyboard tab:
  - Continue to show placeholder but mention real data pending; include supabase-driven check once storyboard artifacts exist (out of scope now).

## Error Handling & Fallbacks
- Introduce shared `SupabaseDataError` type so UI surfaces clear copy (missing credentials, story not found, story missing artifacts).
- Update empty states to include CTA for `supabase:stories-cli` seeding when relevant.
- Keep route dynamic by exporting `dynamic = "force-dynamic"` on story routes to avoid build-time Supabase lookups; add `revalidate = 30` to enable Next caching without stale data risk.
- When Supabase returns 404 for a story, issue `notFound()` to reuse existing 404 UI.

## Documentation & Tooling
- Extend `apps/story-tree-ui/README.md` with a configuration section describing:
  1. Required env vars for local (`STORY_TREE_SUPABASE_MODE=local`, `SUPABASE_LOCAL_URL`, `SUPABASE_LOCAL_SERVICE_ROLE_KEY`).
  2. Remote mode instructions and mapping to existing Supabase CLI secrets.
  3. Quick test flow using `npm run supabase:stories-cli -- list`.
- Provide `.env.local.example` for the UI workspace containing commented placeholders for both modes.

## Stakeholder Alignment
- **Accepted assumptions:** Scenelets exist for showcased stories (else script tab shows empty state). The UI runs in a trusted environment; no additional authentication handling will be implemented in this change.
- **Implementation requirements:** All server-only modules reside under `apps/story-tree-ui-server/`, and Supabase access helpers live under `apps/story-tree-ui-server/supabase/` while reusing the shared repository code in `supabase/`—no duplicate data access layers elsewhere.
