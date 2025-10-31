# story-storage Delta Specification

## MODIFIED Requirements

### Requirement: Store Shot Storyboard Payloads
The shots table MUST store complete storyboard entries in JSONB format without persisting redundant generation prompt strings.

#### Scenario: Shots table excludes prompt and first frame columns
- **GIVEN** the Supabase migrations are applied
- **WHEN** the `public.shots` table is inspected
- **THEN** it MUST NOT include `first_frame_prompt`, `key_frame_prompt`, `video_clip_prompt`, or `first_frame_image_path` columns
- **AND** it MUST include `storyboard_payload JSONB NOT NULL` to store the complete storyboard entry
- **AND** it MUST include only `key_frame_image_path` for generated image storage (first frame generation is deprecated).

#### Scenario: Storyboard payload stores structured audio narrative
- **GIVEN** a shot is persisted after shot production
- **WHEN** the `storyboard_payload` JSONB is inspected
- **THEN** it MUST contain an `audio_and_narrative` array field
- **AND** each array element MUST have `type`, `source`, and `line` fields
- **AND** it MUST contain a `referenced_designs` object with `characters` and `environments` arrays.

### Requirement: Provide Shots Repository API
The repository MUST expose shot records without generation prompt fields and rely on storyboard_payload for all shot metadata.

#### Scenario: Repository does not expose deprecated properties
- **GIVEN** the shots repository returns shot records
- **WHEN** a shot record is mapped from a database row
- **THEN** it MUST NOT include `firstFramePrompt`, `keyFramePrompt`, `videoClipPrompt`, or `firstFrameImagePath` properties
- **AND** it MUST expose `storyboardPayload` containing the full JSONB data
- **AND** it MUST expose only `keyFrameImagePath` when key frame image is generated.

#### Scenario: Repository creates shots without prompt validation
- **GIVEN** the repository receives shots to persist
- **WHEN** `createSceneletShots` executes
- **THEN** it MUST validate that `storyboardPayload` is provided
- **AND** it MUST NOT require or validate `firstFramePrompt`, `keyFramePrompt`, or `videoClipPrompt` fields
- **AND** it MUST insert rows with only `storyboard_payload` for shot metadata.

#### Scenario: Repository reads shots with enhanced storyboard structure
- **GIVEN** shots are stored with the new storyboard structure
- **WHEN** `getShotsByStory` executes
- **THEN** it MUST return shot records with `storyboardPayload` containing `referenced_designs` and `audio_and_narrative`
- **AND** it MUST group shots by scenelet and order them by `scenelet_sequence` and `shot_index`.

## REMOVED Requirements

### Requirement: ~~Validate Generation Prompts During Persistence~~
~~The repository MUST enforce that first_frame_prompt, key_frame_prompt, and video_clip_prompt are non-empty strings.~~

**Rationale**: This requirement is removed because generation prompts are no longer stored in the database; image prompts are assembled from storyboard_payload on-demand.

#### Scenario: ~~Repository rejects empty prompts~~
~~- **GIVEN** the repository receives shots with blank prompt fields~~
~~- **WHEN** `createSceneletShots` executes~~
~~- **THEN** it MUST throw an error rejecting empty `firstFramePrompt`, `keyFramePrompt`, or `videoClipPrompt` values.~~
