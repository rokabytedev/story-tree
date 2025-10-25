## Why
Developers need an easy way to seed and inspect Supabase stories data without hand-writing scripts. A CLI wrapper around the existing stories repository will streamline local testing and let us target either the local Supabase emulator or the remote project.

## What Changes
- Introduce a TypeScript CLI that wraps `storiesRepository` helpers for creating stories and updating their artifacts.
- Allow switching between local (default) and remote Supabase projects via a flag and environment overrides.
- Support piping constitution markdown via command flag or reading from a file for convenience during seeding.

## Impact
- Simplifies manual Supabase testing and UI test data setup.
- No production runtime impact; tool is developer-only.
- Requires documenting new CLI usage and environment expectations.
