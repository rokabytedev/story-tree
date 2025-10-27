## Why
Create a storyboard generation workflow step so the pre-production pipeline produces a persisted storyboard breakdown once constitution, interactive script, and visual design are ready.

## What Changes
- Add a `CREATE_STORYBOARD` task that assembles constitution + story tree + visual design into a Gemini request, validates the response, and stores it on the story record.
- Extend the workflow CLI to expose the new task in both run-one and run-all flows with stub and real Gemini modes.
- Provide response validation utilities ensuring every dialogue line is mapped to a shot using story tree `scenelet_id`s and visual design character names.

## Impact
- Workflow tests, CLI tests, and repository assertions need updates.
- Adds new fixtures for stubbed Gemini storyboard responses.
- Enables downstream tooling to rely on a persisted storyboard JSON document.
