## Why
- The Story Tree UI still renders mocked story data, so it cannot visualize real workflow outputs stored in Supabase.
- Designers and engineers need to inspect production and local stories through the UI without manually swapping data sources.
- We must align the UI with existing Supabase tooling conventions (local vs remote credentials) before layering additional features on top.

## What Changes
- Add a server-side Supabase data layer for the Next.js workspace that reuses the shared repositories.
- Replace mock-based story list and artifact tabs with live queries that fetch stories, artifacts, and scenelet snapshots from Supabase.
- Introduce environment-driven connection mode (local/remote) with documentation so the UI can target different Supabase projects.

## Impact
- Requires `SUPABASE_*` environment variables (service role keys) to be present when running or building the UI.
- Developers will follow updated README steps to choose local or remote Supabase credentials; build/lint commands remain the same.
- No backend schema or API changes; risk is limited to UI data fetching and configuration handling.
