## Why
- The interactive script writer currently exceeds desired path lengths, producing unwieldy scripts.
- The story constitution prompt now defines a `target_scenelets_per_path` field that must flow through the workflow to guide path length.

## What Changes
- Extend the story constitution specification to capture and return the computed `target_scenelets_per_path` value.
- Update the interactive script generation specification so Gemini requests reiterate both the target and current path length inside the user prompt.

## Impact
- Ensures length constraints are available wherever the constitution JSON is consumed.
- Aligns interactive script prompts with the new guardrail, improving compliance with the desired scenelet count.
