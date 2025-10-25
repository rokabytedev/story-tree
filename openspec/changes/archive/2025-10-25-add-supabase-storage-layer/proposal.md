## Why
- Interactive story artifacts (constitution, scripts, visual/audio design, storyboards) currently live only in memory.
- Product roadmap calls for Supabase-backed persistence so artifacts can be shared across agents and environments.
- We also need automated schema deployment to keep remote Supabase instances in sync with migrations committed to main.

## What Changes
- Introduce a `stories` table that stores every generated artifact as JSON alongside metadata fields.
- Ship a typed storage layer module that wraps Supabase client primitives for creating stories and persisting artifact updates.
- Set up a `supabase/` workspace with migrations, CLI config, and README instructions for running the local stack.
- Add GitHub Actions automation that pushes migrations to the remote Supabase project whenever `main` is updated.

## Impact
- Developers can run Supabase locally to test story pipelines end-to-end.
- Automated deploys keep production Supabase schema aligned with the repo.
- Other agents gain a single persistence interface for reading/writing story artifacts.
