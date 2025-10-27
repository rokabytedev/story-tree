## Overview
Storyboard output extends the existing story workflow by layering a Gemini request over the stored constitution, interactive script snapshot, and visual design document. We keep the task implementation modular so prompt formatting, response validation, and persistence are independently testable.

## Components
- **Prompt Builder**: Combines constitution markdown, story tree YAML, and visual design JSON into a deterministic markdown payload. Lives alongside the visual design prompt module and reuses the snapshot serializer.
- **Response Validator**: Enforces the `storyboard_breakdown` schema, validates `scenelet_id` references against the snapshot, checks dialogue coverage, and ensures characters match the visual design roster. Returns a normalized object for storage.
- **Workflow Task**: Injects repositories, prompt builder, Gemini client, and validator. Guards prerequisites, calls Gemini with `system_prompts/storyboard_artist.md`, errors if the story already has a storyboard, and persists the validated payload through `StoriesRepository.updateStoryArtifacts`.
- **CLI Wiring**: Adds `CREATE_STORYBOARD` to the workflow CLI, reusing stub client hooks. Stub responses live in `agent-backend/fixtures/gemini/storyboard/` to keep offline runs deterministic.

## Trade-offs
- Validating dialogue coverage requires traversing the story tree snapshot. We perform this once per task execution and accept the cost for correctness. If performance becomes an issue, we can cache per-scenelet dialogue lines alongside the snapshot.
- Storing the raw Gemini response is avoided to keep Supabase rows clean; only validated JSON is persisted. If we later need auditing, we can extend the repository to store raw payloads separately.
