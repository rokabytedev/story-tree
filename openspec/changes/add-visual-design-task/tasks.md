## Tasks
- [ ] Finalize the flattened YAML story tree schema and document it in `docs/004_concept_art_and_production_design_plan.md`.
- [ ] Add repository/service logic to fetch all scenelets for a story id and build the YAML-ready story tree snapshot with unit tests.
- [ ] Implement the visual design task orchestration that loads constitution + story tree, calls Gemini with the injected client, and persists `visual_design_document`.
- [ ] Extend the workflow runner and CLI to schedule the `CREATE_VISUAL_DESIGN` task after interactive script generation.
- [ ] Add high-level integration tests covering success, missing prerequisites, Gemini failures, and repeated task invocations while respecting existing `visual_design_document`.
- [ ] Update developer documentation for running the task and expectations for TDD.
