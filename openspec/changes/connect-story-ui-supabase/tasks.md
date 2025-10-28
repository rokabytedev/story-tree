1. Add server-only Supabase client/config resolver under `apps/story-tree-ui/server/supabase/`, reusing shared repositories and covering local/remote mode resolution plus error types.
2. Replace story index data source with Supabase-backed summaries, including empty states for missing credentials or stories.
3. Update story layout and artifact tabs to load live constitution, story tree YAML, visual/audio/reference JSON, and render helpful fallbacks when artifacts are missing.
4. Document configuration in `apps/story-tree-ui/README.md` and add an `.env.local.example` that lists local/remote credential variables.
5. Validation: run `npm run lint -- --max-warnings=0` and `npm run build` from `apps/story-tree-ui`.
