## MODIFIED Requirements
### Requirement: Persist Story Artifacts in Supabase
The stories table MUST now record the player's original prompt and drop the unused `interactive_script` column.

#### Scenario: Stories table captures prompt and artifacts as JSON
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.stories` table is inspected
- **THEN** it MUST include an `initial_prompt` text column that stores the user brief
- **AND** it MUST include JSONB columns `story_constitution`, `visual_design_document`, `audio_design_document`, `visual_reference_package`, `storyboard_breakdown`, and `generation_prompts`
- **AND** the legacy `interactive_script` JSONB column MUST be absent.

### Requirement: Provide Stories Repository API
The repository MUST expose the stored prompt and stop referencing the removed column.

#### Scenario: Repository maps prompt field
- **GIVEN** the stories repository returns a record
- **WHEN** the story row includes `initial_prompt`
- **THEN** the repository MUST surface it as `initialPrompt`
- **AND** it MUST NOT expose an `interactiveScript` property anymore.

#### Scenario: Repository updates display name
- **GIVEN** a caller provides a story id and new title
- **WHEN** the repository helper updates the story
- **THEN** it MUST set `display_name` to the provided value alongside any artifact changes
- **AND** it MUST return the refreshed record.
