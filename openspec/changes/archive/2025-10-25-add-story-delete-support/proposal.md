## Why
- Engineers currently have to manually purge Supabase rows when a generated story should be removed.
- The stories repository lacks a delete helper, so downstream services cannot implement clean up flows.
- The Supabase CLI mirrors repository capabilities but offers no way to delete stories during manual testing.

## What Changes
- Extend the stories repository contract with a `deleteStoryById` helper that removes a row or surfaces a not-found error.
- Add a `delete` command to the Supabase Stories CLI that calls the repository helper and prints a confirmation message.
- Document the new CLI command in the built-in help output.

## Impact
- Developers and automation can clean up unwanted stories without touching Supabase dashboards.
- CLI workflows stay aligned with repository capabilities, reducing drift between tooling and APIs.
- Better parity makes it safer to iterate on story data without accumulating stale rows.
