## Overview
The change connects Gemini-powered story tree generation with Supabase persistence. A DFS-like orchestrator coordinates Gemini calls, converts responses into scenelet records, and records nodes in a new `scenelets` table linked to `stories`.

## Key Decisions
- **Stack-based traversal:** Follow the interactive scripting plan by advancing depth-first using a stack of tasks so branches are explored deterministically and intermediate state stays in memory.
- **Prompt encapsulation:** Reuse the existing Gemini client with a new prompt loader for `system_prompts/create_interactive_script.md`; request payload construction lives in a pure helper to keep orchestration deterministic and testable.
- **Repository boundary:** Introduce a Supabase repository responsible for inserting scenelets, marking branch metadata, and querying child paths. This isolates database specifics from the generator.
- **Schema flags:** Store branch prompts and terminal indicators directly on each scenelet to support runtime traversal without re-computing Gemini responses.
- **Test strategy:** Unit tests rely on stub Gemini transports and in-memory repository fakes so they verify traversal logic without network or database access; migration tests cover schema shape through SQL assertions.

## Open Questions
- How many concurrent stories can be generated at once? The current design assumes a single-threaded orchestrator. If concurrency requirements emerge, add queueing or distributed workers.
