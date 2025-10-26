## Why
We need a single entry point that turns a player's idea into a fully scaffolded story experience. The agent workflow plan outlines the first slice: capture the user brief, produce the story constitution, and kick off interactive script generation while persisting everything in Supabase. Without this orchestrator the end-to-end flow must be stitched together manually and data like the player prompt has nowhere to live.

## What Changes
- Introduce an agent workflow orchestrator that creates the story row, records the player prompt, invokes constitution generation, and launches interactive script generation.
- Update the Supabase schema and repositories so stories store the initial prompt and drop the deprecated `interactive_script` JSON column.
- Provide testable orchestration/business logic separated from the CLI or IO layer so we can drive it with fakes per the TDD requirement.

## Impact
- Product can ask for a story prompt and immediately see the constitution plus interactive scenelets materialise.
- Supabase schema evolves in a backwards-incompatible way (safe because environments have no persistent data yet).
- The workflow gains thorough unit coverage with fake Gemini and persistence layers, making further steps easier to extend safely.
