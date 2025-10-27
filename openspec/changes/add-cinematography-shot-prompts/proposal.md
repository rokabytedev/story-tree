## Why
Storyboard and audio design give us the creative blueprint, but we still lack the per-shot prompts needed to actually render frames or video. The cinematography agent must turn every storyboard shot into three production-ready prompts while respecting visual and audio canon. Without a concerted capability, operators have to hand-assemble prompts and we risk giant JSON payloads living in a single Supabase column.

## What Changes
- Add a dedicated workflow task that iterates storyboard shots, calls the cinematography Gemini prompt once per shot, and persists the validated prompts.
- Extend storage with a first-class `shot_generation_prompts` table and repository helpers so each shot’s prompts have their own row keyed by story, scenelet, and shot index.
- Wire CLI, prompt assembly, validation, and fixture-driven tests so the new task slots into both `run-task` and `run-all` flows without touching real Gemini during TDD.

## Impact
- Stories gain reproducible prompt packages that downstream rendering agents can consume immediately.
- Supabase schema expands; deployments must apply the new migration before the workflow ships.
- Test surface area grows (prompt builder, validator, workflow orchestration, CLI), but reuse of existing patterns keeps maintenance predictable.
