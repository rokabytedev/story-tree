## 1. Repository Deletion Helper
- [x] 1.1 Update the stories repository contract and implementation to delete a story by id with proper error handling.
- [x] 1.2 Add Vitest coverage for delete success, missing story, and Supabase error paths.

## 2. Stories CLI Delete Command
- [x] 2.1 Extend the stories CLI parser, help text, and runtime flow to support a `delete` command.
- [x] 2.2 Cover the new CLI behaviour with tests, including success, missing story, and error output cases.

## 3. Validation
- [x] 3.1 Run `openspec validate add-story-delete-support --strict` and ensure it passes.
- [x] 3.2 Execute `npm test -- supabase` to confirm Supabase-focused tests succeed.
