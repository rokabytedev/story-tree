## MODIFIED Requirements
### Requirement: Gemini Interactive Scriptwriter Invocation
The generator MUST call Gemini with the `system_prompts/create_interactive_script.md` prompt, the current path context, and an instruction that distinguishes the root versus continuation scenelets.

#### Scenario: Prompt reiterates path length constraint
- **GIVEN** the generator prepares the user prompt for Gemini
- **WHEN** a story constitution includes `targetSceneletsPerPath` and the current narrative path already contains scenelets
- **THEN** the prompt's `## Current Narrative Path` section MUST state both the target path length and the current scenelet count
- **AND** it MUST calculate the scenelet count from the path data rather than trusting cached values
- **AND** the prompt MUST remind Gemini that remaining scenelets should conclude within the stated target.
