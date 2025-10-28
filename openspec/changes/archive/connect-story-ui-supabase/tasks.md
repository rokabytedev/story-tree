# Tasks: Connect Story Tree UI to Supabase

## 1. Server-Side Foundation
- [x] 1.1. Create a server-only Supabase client resolver at `apps/story-tree-ui/src/server/supabase.ts` that handles `local` and `remote` modes based on environment variables.
- [x] 1.2. Add `apps/story-tree-ui/.env.local.example` to document the required Supabase environment variables for both modes.
- [x] 1.3. Update `apps/story-tree-ui/README.md` with instructions for configuring and connecting to local and remote Supabase projects.
- [x] 1.4. Implement the data access layer in `apps/story-tree-ui/src/server/data/stories.ts` with `getStoryList()` and `getStory(storyId)` functions that reuse the shared `storiesRepository`.

## 2. Story Index Page
- [x] 2.1. Convert the story index page (`apps/story-tree-ui/src/app/story/page.tsx`) into an `async` server component.
- [x] 2.2. Replace the mock data fetching with a call to `getStoryList()` and render the live story data.
- [x] 2.3. Implement an empty state for the index page that appears when no stories are found or the database is not configured.

## 3. Story Detail Page & Layout
- [x] 3.1. Convert the story detail layout (`apps/story-tree-ui/src/app/story/[storyId]/layout.tsx`) into an `async` server component.
- [x] 3.2. Remove `generateStaticParams` and fetch story metadata using `getStory(params.storyId)`, handling not-found cases.
- [x] 3.3. Implement the data access function `getStoryTreeScript(storyId)` that uses the `sceneletsRepository` and `assembleStoryTreeSnapshot` to generate the script YAML.

## 4. Artifact Tabs
- [x] 4.1. **Constitution Tab**: Update `.../[storyId]/constitution/page.tsx` to fetch and render the live `storyConstitution` markdown or an empty state.
- [x] 4.2. **Script Tab**: Update `.../[storyId]/script/page.tsx` to fetch and render the YAML from `getStoryTreeScript()` or an empty state.
- [x] 4.3. **Visual Tab**: Update `.../[storyId]/visual/page.tsx` to fetch and render the `visualDesignDocument` JSON or an empty state.
- [x] 4.4. **Audio Tab**: Update `.../[storyId]/audio/page.tsx` to fetch and render the `audioDesignDocument` JSON or an empty state.

## 5. Cleanup & Validation
- [x] 5.1. Remove the now-unused mock data file at `apps/story-tree-ui/src/data/mockStory.ts`.
- [x] 5.2. Run `npm run lint -- --max-warnings=0` and `npm run build` from the `apps/story-tree-ui` workspace to ensure all changes are clean and the project builds successfully.
