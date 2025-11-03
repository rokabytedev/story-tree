## ADDED Requirements
### Requirement: Provide Embedded Player Bundle Accessor
The story workflow MUST expose an accessor that assembles player bundle data for embedded surfaces without copying assets.
#### Scenario: Embedded accessor returns generated asset URLs
- **GIVEN** a story has playable shots stored under `apps/story-tree-ui/public/generated/{storyId}/`
- **WHEN** the embedded accessor is invoked with that story id
- **THEN** it MUST return the same StoryBundle shape produced for the standalone player
- **AND** every shot imagePath and audioPath in the returned bundle MUST resolve to `/generated/{storyId}/shots/{sceneletId}/{shotIndex}_key_frame.png` and `/generated/{storyId}/shots/{sceneletId}/{shotIndex}_audio.wav` (or null when absent)
- **AND** music cues, when present, MUST resolve to `/generated/{storyId}/music/{cueName}.m4a`

#### Scenario: Embedded accessor reuses bundle assembler and avoids asset copies
- **GIVEN** the embedded accessor assembles data
- **WHEN** it runs
- **THEN** it MUST call `assembleBundleJson` with a manifest override instead of duplicating bundle logic
- **AND** it MUST NOT copy or mutate files under `/output/stories`
- **AND** it MUST surface the same validation errors as the standalone bundle task when playable assets are missing
