## Overview
The workflow orchestrator glues our existing capabilities together:
- Supabase stories repository persists the new story row plus constitution metadata.
- Supabase scenelets repository already supports interactive story generation.
- Gemini-backed helpers produce the constitution and scenelets.

The orchestrator itself remains pure by depending on interfaces so tests can drive it with fakes.

## Key Decisions
- **Dependency injection:** The orchestrator accepts repository and generator functions instead of constructing them so unit tests avoid touching Supabase or Gemini.
- **Prompt persistence:** We store the raw player prompt in a new `initial_prompt` JSONB column; this keeps provenance for future refinements.
- **Display name lifecycle:** We keep using a placeholder display name on create (`'Untitled Story'`) and immediately patch it to the constitution title once Gemini responds. This keeps the existing `display_name` constraint satisfied while aligning the row with the generated title.
- **Interactive script generation trigger:** We re-use the existing DFS generator and scenelet persistence; the orchestrator simply invokes it after saving the constitution so scenelets populate asynchronously in the same transaction scope.

## Follow-ups / Risks
- Constitution failures currently leave the created story in place; future work may decide to soft-delete or mark it as failed.
- Long-running interactive generation may deserve background worker orchestration later; for now it runs inline per the plan.
