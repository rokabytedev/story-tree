# Legacy Notice: Storyboard Plan Superseded

The original `CREATE_STORYBOARD` task has been retired. Storyboard composition and cinematography prompt generation now live inside the unified **Shot Production Task** documented in `docs/007_shot_production_refactor_plan.md`.

Key takeaways:
- Gemini now evaluates one **scenelet** at a time and emits the full ordered shot list (with storyboard metadata and the three generation prompts per shot) in a single response.
- Outputs are persisted in the new `shots` table instead of `stories.storyboard_breakdown` or `stories.generation_prompts`.
- Workflow sequencing replaces `CREATE_STORYBOARD` and `CREATE_SHOT_PROMPTS` with `CREATE_SHOT_PRODUCTION`.

Refer to the Shot Production plan for full design, storage schema, workflow orchestration, CLI guidance, and testing strategy. This file remains only to redirect readers who encounter legacy references.
