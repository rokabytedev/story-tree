## MODIFIED Requirements
### Requirement: Return Parsed Story Constitution JSON
The function MUST validate and return Gemini's JSON output as a typed object containing the proposed title, markdown constitution, and the scenelet target per path.

#### Scenario: Target scenelet count surfaced
- **GIVEN** Gemini returns a payload that includes `target_scenelets_per_path`
- **WHEN** the constitution generator parses the response
- **THEN** it MUST expose the integer as `targetSceneletsPerPath` in the returned object
- **AND** the value MUST be persisted untouched when the constitution is stored.

#### Scenario: Default target length applied
- **GIVEN** the user's prompt omits an explicit length request
- **WHEN** the story constitution is generated
- **THEN** the system prompt MUST instruct Gemini to default the target to 12 scenelets per path
- **AND** the parsed response MUST provide `target_scenelets_per_path: 12`.

#### Scenario: Story length requests convert to scenelet targets
- **GIVEN** the user specifies a desired runtime (e.g., "a 10 minute story") or scenelet count
- **WHEN** the constitution prompt is assembled
- **THEN** it MUST instruct Gemini to translate minutes into scenelets at a 2:1 ratio or to use the provided count directly
- **AND** the returned `target_scenelets_per_path` MUST reflect that computed value.
