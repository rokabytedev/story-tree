carefully read `docs/009_resume_mode_plan.md` before doing any task!

1. Implement Gemini retry helper with exponential backoff, integrate into interactive story generator and expose override hooks.
2. Extend scenelet persistence and workflow options to surface stored scenelets and enable resume mode flag.
3. Add resume planner logic and generator entrypoint changes to seed pending tasks from existing scenelets.
4. Update workflow, CLI, and logging to respect the resume flag and emit useful diagnostics.
5. Refresh or add unit/integration tests for retry behaviour, resume planner scenarios, generator resume, workflow flag, and CLI flag handling.
6. Run automated tests and update documentation (including `docs/009_resume_mode_plan.md`) if adjustments are made during implementation.
