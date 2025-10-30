# story-storage Specification Delta

## MODIFIED Requirements

### Requirement: Persist Story Artifacts in Supabase
The stories table MUST record visual reference image paths within the visual reference package JSON.

#### Scenario: Visual reference package includes image paths
- **GIVEN** a story's `visual_reference_package` has been updated with generated image paths
- **WHEN** the stories repository persists the package
- **THEN** it MUST store `image_path` fields nested within `character_model_sheets[*].sheets[*]` and `environment_keyframes[*].keyframes[*]`
- **AND** it MUST preserve existing JSON structure while adding the new `image_path` fields
- **AND** repository round-trip tests MUST verify `image_path` values persist correctly.

### Requirement: Store Shot Production Output
The database MUST provide `first_frame_image_path` and `key_frame_image_path` columns in the `shots` table to persist generated storyboard image paths.

#### Scenario: Shots table stores image paths for both frames
- **GIVEN** Supabase migrations are applied
- **WHEN** `public.shots` is inspected
- **THEN** it MUST include a `first_frame_image_path` column (TEXT, nullable)
- **AND** it MUST include a `key_frame_image_path` column (TEXT, nullable)
- **AND** the repository MUST expose the fields as `firstFrameImagePath` and `keyFrameImagePath` in TypeScript types
- **AND** the repository MUST allow updating these paths independently without affecting other columns.

#### Scenario: Repository updates shot image paths
- **GIVEN** a shot record exists with no image paths
- **WHEN** the shots repository `updateShotImagePaths(storyId, sceneletId, shotIndex, paths)` is called
- **THEN** it MUST set the `first_frame_image_path` and/or `key_frame_image_path` columns to the provided values
- **AND** it MUST support updating only one path if the other is already populated (resume mode)
- **AND** it MUST return the updated shot record
- **AND** it MUST throw an error if the shot doesn't exist
- **AND** tests MUST verify idempotent updates (updating the same paths multiple times succeeds).

#### Scenario: Repository queries shots missing image paths
- **GIVEN** a story has multiple shots, some with image paths populated
- **WHEN** the repository `findShotsMissingImages(storyId)` is called
- **THEN** it MUST return only shots where `first_frame_image_path` IS NULL OR `key_frame_image_path` IS NULL
- **AND** it MUST order results by `scenelet_sequence` and `shot_index`
- **AND** it MUST include all shot metadata (scenelet ID, index, prompts, existing image paths) for the caller's use
- **AND** the caller can determine which specific images need generation based on which paths are NULL.

## ADDED Requirements

### Requirement: Provide Image Path Storage Helpers
The storage layer MUST expose utilities for constructing and validating image paths relative to the public directory.

#### Scenario: Helper constructs visual reference image path
- **GIVEN** a story ID, category ("characters" or "environments"), name, and index
- **WHEN** the path helper `buildVisualReferencePath(storyId, category, name, index)` is called
- **THEN** it MUST return a relative path like `<story-id>/visuals/<category>/<normalized-name>/model_sheet_<index>.png` for characters or `keyframe_<index>.png` for environments
- **AND** it MUST normalize the name to a filesystem-safe format
- **AND** it MUST validate that the index is a positive integer.

#### Scenario: Helper constructs shot image paths
- **GIVEN** a story ID, scenelet ID, shot index, and frame type ("first_frame" or "key_frame")
- **WHEN** the path helper `buildShotImagePath(storyId, sceneletId, shotIndex, frameType)` is called
- **THEN** it MUST return a relative path like `<story-id>/shots/<scenelet-id>_shot_<index>_first_frame.png` or `<story-id>/shots/<scenelet-id>_shot_<index>_key_frame.png`
- **AND** it MUST validate that the shot index is a positive integer
- **AND** it MUST validate that frameType is either "first_frame" or "key_frame"
- **AND** it MUST sanitize the scenelet ID to prevent path traversal.

#### Scenario: Helper validates path format
- **GIVEN** a relative image path string
- **WHEN** the validation helper `validateImagePath(path)` is called
- **THEN** it MUST ensure the path contains no `..` or absolute path indicators
- **AND** it MUST verify the path starts with a story ID pattern
- **AND** it MUST throw an error for malformed or potentially unsafe paths.
