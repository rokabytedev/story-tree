## Why
Story trees currently cannot be generated or persisted beyond the root story record. The interactive scripting plan requires a Gemini-driven iterative generator and Supabase storage for scenelets so stories become playable.

## What Changes
- Add an interactive story generation orchestrator that calls the Gemini interactive scriptwriter prompt iteratively to expand story trees.
- Introduce Supabase scenelet persistence so generated branches and metadata are stored and queryable.
- Provide tooling and tests that cover Gemini response handling and repository behaviour without external dependencies.

## Impact
- Backend gains the ability to create complete interactive story trees for a story id.
- Database layer expands to manage scenelet nodes linked to stories.
- Test suites cover new workflows, enabling regression checks without live Gemini or Supabase usage.
