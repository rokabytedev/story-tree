# Design: Connect Story Tree UI to Supabase

## Overview
The Story Tree UI currently renders mock data. This change introduces a server-side data layer that queries Supabase so designers and engineers can inspect real stories. We will reuse the shared Supabase repositories, expose deterministic view models for the UI, and support both local and remote stacks through environment-based configuration. All data fetching stays in server components to keep service role secrets out of the browser bundle.

## Supabase Connection Strategy
A server-only Supabase client will be created in `apps/story-tree-ui/src/server/supabase.ts`. This module will adapt the existing `createSupabaseServiceClient` factory from `supabase/src/client.ts` to handle UI-specific environment variables and configuration modes.

### Environment Configuration
The UI will support `local` and `remote` Supabase environments, controlled by the `STORY_TREE_SUPABASE_MODE` environment variable.

- **Remote Mode**:
  - `STORY_TREE_SUPABASE_MODE=remote`
  - `SUPABASE_REMOTE_URL`: The URL of the production Supabase project.
  - `SUPABASE_REMOTE_SERVICE_ROLE_KEY`: The service role key for the production project.
- **Local Mode (Default)**:
  - `STORY_TREE_SUPABASE_MODE=local` (or omitted)
  - `SUPABASE_LOCAL_URL`: The URL for the local Supabase stack (e.g., `http://127.0.0.1:54321`).
  - `SUPABASE_LOCAL_SERVICE_ROLE_KEY`: The service role key for the local stack.
- **Fallback**: For convenience, the client resolver will also check for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if the mode-specific variables are not found.

The client factory will be memoized (e.g., using `React.cache`) to ensure a single client instance is created per request, preventing connection overhead. Accessing the service role key will be strictly limited to server-side files to prevent leaks into the browser.

## Data Access Layer
The data access layer will live in `apps/story-tree-ui/src/server/data/` and will provide high-level functions for fetching page-specific data. This layer will use the server-only Supabase client and reuse the existing repositories from the `supabase` and `agent-backend` packages.

### Key Functions
- `getStoryList()`: Fetches all stories using `storiesRepository.listStories()` and returns a summary view model (`{ id, title, author, accentColor }`) for the story index page.
- `getStory(storyId)`: Fetches a single story's complete record using `storiesRepository.getStoryById()`.
- `getStoryTreeScript(storyId)`: Fetches all scenelets for a story using `sceneletsRepository.listSceneletsByStory()`, then uses `assembleStoryTreeSnapshot()` from `agent-backend` to generate the YAML representation for the Script tab.

These functions will be designed to be called from Next.js Server Components. They will handle data transformation and gracefully return `null` or empty arrays when data is not found, allowing the UI to render appropriate empty states.

## UI Implementation
Data fetching will occur exclusively in Server Components (`page.tsx`, `layout.tsx`). Mock data imports from `@/data/mockStory` will be removed and replaced with calls to the new data access layer.

### Story Index Page (`/story`)
- The `StoryIndexPage` in `apps/story-tree-ui/src/app/story/page.tsx` will be converted to an `async` component.
- It will call `getStoryList()` to fetch stories from Supabase.
- If no stories are returned, it will render an empty state component that guides the developer on how to seed the database.

### Story Detail Layout (`/story/[storyId]`)
- The `StoryLayout` in `apps/story-tree-ui/src/app/story/[storyId]/layout.tsx` will become an `async` component.
- It will fetch the story record using `getStory(params.storyId)`. This ensures all child pages (tabs) have access to the story's metadata (like the title) without re-fetching it.
- The `generateStaticParams` function will be removed, as stories will be dynamic.
- If a story is not found, it will use the `notFound()` function from Next.js.

### Artifact Tabs (`/story/[storyId]/[tab]`)
- Each tab's page component (e.g., `apps/story-tree-ui/src/app/story/[storyId]/constitution/page.tsx`) will be an `async` component.
- It will fetch its specific data. For example, the Constitution tab will get the story record and access the `storyConstitution` property. The Script tab will call `getStoryTreeScript()`.
- If a specific artifact is `null` or empty (e.g., `story.storyConstitution` is null), the component will render an `<EmptyState />` with a relevant message.

## Documentation & Tooling
- An `.env.local.example` file will be added to `apps/story-tree-ui/` to document the required environment variables for both local and remote Supabase connections.
- The `apps/story-tree-ui/README.md` will be updated with detailed instructions on how to:
  1.  Set up the environment variables.
  2.  Run the UI against the local Supabase stack.
  3.  Connect the UI to the remote Supabase project.

## Stakeholder Alignment
- **Accepted assumptions:** Scenelets exist for showcased stories (else script tab shows empty state). The UI runs in a trusted environment; no additional authentication handling will be implemented in this change.