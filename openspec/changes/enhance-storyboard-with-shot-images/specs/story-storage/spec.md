# story-storage Spec Delta

## MODIFIED Requirements

### Requirement: Provide Shots Repository API

The storage layer MUST expose helpers for reading, inserting, and validating scenelet shots, including image path retrieval for UI visualization.

#### Scenario: Repository reads shots with image paths

- **GIVEN** the repository receives a story id with stored shots
- **WHEN** `getShotsByStory` executes
- **THEN** it MUST fetch rows ordered by `scenelet_sequence` and `shot_index`, group them by scenelet id, and map fields to camel-case properties for callers
- **AND** each shot record MUST include `keyFrameImagePath` and `firstFrameImagePath` fields
- **AND** the fields MUST be null when no image paths are stored
- **AND** the fields MUST return the stored string values when present

#### Scenario: Repository supports querying shots by scenelet IDs

- **GIVEN** the repository receives a story id and a list of scenelet ids
- **WHEN** a new method `getShotsByScenelets` executes
- **THEN** it MUST fetch only shots matching the provided scenelet ids
- **AND** it MUST return results grouped by scenelet_id as a map
- **AND** each scenelet group MUST contain shots ordered by shot_index ascending
- **AND** it MUST handle empty scenelet id lists by returning an empty map
- **AND** it MUST trim and filter out blank scenelet ids before querying
