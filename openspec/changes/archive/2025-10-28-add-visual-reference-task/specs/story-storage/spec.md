## MODIFIED Requirements
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

#### Scenario: Repository maps visual reference package
- **GIVEN** a story row includes `visual_reference_package`
- **WHEN** the repository loads or updates artifacts
- **THEN** it MUST surface the value as `visualReferencePackage`
- **AND** `updateStoryArtifacts` MUST allow callers to persist a validated visual reference package without overwriting other artifacts
- **AND** repository tests MUST cover round-tripping the visual reference package during create and update flows.
