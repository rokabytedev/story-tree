## Why
Visual design gives us character and environment direction, but downstream art workflows still lack a single source of truth for the exact prompts that image generators must use. Artists and automation alike need deterministic reference plates—especially character model sheets—to maintain visual continuity. Today the workflow stops after visual design, leaving production teams to improvise Gemini prompts manually. We need a dedicated visual reference task to translate the approved visual design canon into generation-ready prompts and persist them alongside the story so later stages can reuse them reliably.

## What Changes
- Add a `CREATE_VISUAL_REFERENCE` workflow task that consumes the story constitution, story tree snapshot, and visual design document to assemble a Gemini request using the Generative Art Director system prompt.
- Implement response validation that enforces referential integrity with the visual design document, requires at least one `CHARACTER_MODEL_SHEET` plate per character, and guarantees every prompt is non-empty before persisting to Supabase.
- Persist the resulting `visual_reference_package` to `stories.visual_reference_package`, expose the artifact through repositories, wire the task into the CLI, and supply stub fixtures plus unit tests.
- Rename or alias the system prompt asset so developers interact with a `create_visual_reference` name that better matches the task’s intent while keeping the existing prompt content intact.

## Impact
- Introduces a new Gemini integration path; requires additional fixtures, contract tests, and workflow orchestration updates.
- Tightens repository contracts around `visual_reference_package`, so related TypeScript interfaces and migrations must stay synchronized.
- CLI and documentation updates are needed to teach operators about the new task and to include visual reference validation in stub pipelines.
- No new Supabase columns are required, but the deployment pipeline must remain aware that stories now block on this artifact before audio design runs.
