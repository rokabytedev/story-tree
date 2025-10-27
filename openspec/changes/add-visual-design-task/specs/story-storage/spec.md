## ADDED Requirements
### Requirement: Provide Story Tree Snapshot
The storage layer MUST expose a repository method that returns the full interactive script as a YAML-ready story tree snapshot for a given story id.

#### Scenario: Story tree snapshot lists nodes and branches
- **GIVEN** the repository is invoked with a story id that has scenelets
- **WHEN** it returns the story tree snapshot
- **THEN** the payload MUST provide sequential human-readable ids for every scenelet (`scenelet-1`, `scenelet-2`, …) and branching point (`branching-point-1`, …)
- **AND** each scenelet entry MUST expose `role`, `description`, `dialogue`, `shot_suggestions`, and an optional `choice_label` when the scenelet originates from a branch
- **AND** each branching point entry MUST expose its `choice_prompt` and an array of `{ label, leads_to }` pairs referencing the scenelet ids
- **AND** it MUST include a deterministic YAML string that mixes scenelets and branching points in depth-first order to match the visual design prompt example
- **AND** the YAML output MUST omit the `role` field for linear continuations to keep the structure lightweight
- **AND** the method MUST throw an error if the story lacks a root scenelet or contains orphaned children.

#### Scenario: Snapshot avoids exposing Supabase identifiers
- **GIVEN** scenelets are persisted with UUID primary keys
- **WHEN** the story tree snapshot is generated
- **THEN** it MUST omit Supabase UUIDs from the output
- **AND** it MUST use the stable sequential ids everywhere those nodes are referenced.

#### Scenario: Snapshot separates IO and assembly
- **GIVEN** unit tests construct fake scenelets without hitting Supabase
- **WHEN** the story tree assembler runs
- **THEN** it MUST operate purely on in-memory data structures
- **AND** the database querying logic MUST be isolated so tests can supply scenelets directly without a live connection.
