## Why
- The production pipeline needs a repeatable workflow task that converts a completed interactive script and its story constitution into a Gemini-driven visual design document.
- Visual design requires the full branching script, but the backend lacks an aggregate view of scenelets for a story.
- The `docs/004_concept_art_and_production_design_plan.md` artifact must spell out how engineers deliver this task end to end.

## What Changes
- Define a workflow task that runs after interactive script generation and persists the returned visual design document to `stories.visual_design_document`.
- Introduce a reusable service that assembles the interactive script into a concise YAML-ready story tree snapshot suitable for AI prompts.
- Teach the CLI workflow runner to dispatch the new task without creating a separate command.
- Document how the visual design agent prompt is assembled, including constitution, serialized story tree, and task prerequisites.

## Scope
- Update specs for `story-workflow` to include the new task, ordering, and validation rules.
- Add a new `visual-design` capability that governs Gemini invocation and persistence expectations.
- Extend `story-storage` specs to cover fetching all scenelets and presenting them as a branching tree payload for the YAML serializer.
- Produce `docs/004_concept_art_and_production_design_plan.md` with implementation guidance, TDD expectations, and data contracts.

## Out of Scope
- Implementing the visual design task or changing Supabase schemas beyond what `story-storage` already exposes.
- Adjusting Gemini prompts beyond the documented system prompt file.

## Impact
- Establishes a clear contract for building the visual design workflow task.
- Reduces ambiguity for downstream AI integrations by standardizing the story tree payload.
- Enables incremental development by separating IO (DB fetch) from business logic (tree assembly and Gemini orchestration).
