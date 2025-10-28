## Why
Our current split between storyboard and cinematography agents creates mismatched workloads. The storyboard task synthesizes every shot in a single Gemini call, while the cinematography task revisits each shot individually to craft prompts. This duplication is brittle, produces oversized payloads, and leaves the storyboard incapable of adjusting shot counts dynamically. We need a unified shot production flow where each Gemini call plans an entire scenelet’s shots—deciding the sequence holistically and returning storyboard metadata plus generation prompts in one response.

## What Changes
- Replace the separate storyboard and cinematography tasks with a single shot production task that iterates scenelets, generating the complete set of shots for one scenelet per Gemini request while still allowing the model to adjust shot counts dynamically.
- Introduce a dedicated `shots` table storing per-shot storyboard metadata and prompt strings, removing the story-level `storyboard_breakdown` and `generation_prompts` columns.
- Rework workflow orchestration, CLI entry points, fixtures, and validation logic to use the new single task and storage model.
- Author a combined system prompt that fuses storyboard composition rules with cinematography/audio direction so Gemini returns both the shot plan and prompts in one JSON payload.

## Impact
- Streamlines Gemini usage (one model call per scenelet) and guarantees storyboard + prompt consistency.
- Requires Supabase migrations and repository updates; deployments must apply the new schema before the workflow ships.
- Large test and fixture updates are needed, but the new structure simplifies future additions like retry logic or selective shot regeneration.
