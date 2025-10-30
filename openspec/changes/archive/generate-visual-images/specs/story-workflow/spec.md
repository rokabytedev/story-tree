# story-workflow Specification Delta

## ADDED Requirements

### Requirement: Schedule Visual Reference Image Generation Task
The workflow MUST expose a `CREATE_VISUAL_REFERENCE_IMAGES` task that generates character and environment images from the visual reference package and persists image paths.

#### Scenario: runAllTasks executes visual reference image generation after visual reference
- **GIVEN** a story with a stored `visual_reference_package` but no image paths populated
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke `CREATE_VISUAL_REFERENCE_IMAGES` immediately after `CREATE_VISUAL_REFERENCE`
- **AND** it MUST skip the task if all character model sheets and environment keyframes already have `image_path` values
- **AND** it MUST update the `visual_reference_package` JSON with generated image paths.

#### Scenario: Visual reference image task validates prerequisites
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_VISUAL_REFERENCE_IMAGES')` executes
- **THEN** it MUST throw a descriptive error if the story lacks a `visual_reference_package`
- **AND** it MUST proceed if the package exists and contains at least one character or environment entry
- **AND** it MUST skip entries that already have `image_path` populated (resume mode).

#### Scenario: Visual reference image task generates character model sheets
- **GIVEN** a visual reference package with character model sheets lacking image paths
- **WHEN** the task executes
- **THEN** it MUST iterate over each character in `character_model_sheets`
- **AND** for each sheet entry without `image_path`, it MUST call the Gemini image client with the `image_generation_prompt`
- **AND** it MUST save the returned image buffer to `visuals/characters/<normalized-character-name>/model_sheet_<N>.png`
- **AND** it MUST update the sheet entry with the relative path in `image_path`
- **AND** it MUST use a 16:9 aspect ratio by default for character reference images.

#### Scenario: Visual reference image task generates environment keyframes
- **GIVEN** a visual reference package with environment keyframes lacking image paths
- **WHEN** the task executes
- **THEN** it MUST iterate over each environment in `environment_keyframes`
- **AND** for each keyframe without `image_path`, it MUST call the Gemini image client with the `image_generation_prompt`
- **AND** it MUST save the image to `visuals/environments/<normalized-environment-name>/keyframe_<N>.png`
- **AND** it MUST update the keyframe with the relative path in `image_path`
- **AND** it MUST use a 16:9 aspect ratio by default for environment keyframes
- **AND** it MUST persist the updated `visual_reference_package` to the stories repository.

#### Scenario: Visual reference image task supports resume mode
- **GIVEN** a partially completed visual reference image generation (some images already have paths)
- **WHEN** the task is invoked again
- **THEN** it MUST skip entries that already have non-empty `image_path` values
- **AND** it MUST only generate images for entries missing paths
- **AND** it MUST not regenerate or overwrite existing images unless explicitly requested.

### Requirement: Schedule Shot Image Generation Task
The workflow MUST expose a `CREATE_SHOT_IMAGES` task that generates storyboard images for all shots using character reference images for consistency.

#### Scenario: runAllTasks executes shot image generation after shot production
- **GIVEN** a story with stored shots and a visual reference package with image paths
- **WHEN** `runAllTasks` executes
- **THEN** it MUST invoke `CREATE_SHOT_IMAGES` immediately after `CREATE_SHOT_PRODUCTION`
- **AND** it MUST skip the task if all shots already have both `first_frame_image_path` and `key_frame_image_path` populated
- **AND** it MUST update shot records via the shots repository with generated image paths for both frames.

#### Scenario: Shot image task validates prerequisites
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_SHOT_IMAGES')` executes
- **THEN** it MUST throw a descriptive error if the story has no stored shots
- **AND** it MUST throw an error if the story lacks a `visual_reference_package` with populated character image paths
- **AND** it MUST verify that visual reference images exist on the filesystem before proceeding
- **AND** it MUST fail fast if any required character reference images are missing.

#### Scenario: Shot image task loads character reference images
- **GIVEN** a shot's storyboard payload references one or more characters
- **WHEN** the task prepares the Gemini request
- **THEN** it MUST extract character names from the shot's `storyboard_payload` JSON
- **AND** it MUST look up each character's reference images from the `visual_reference_package`
- **AND** it MUST prioritize CHARACTER_MODEL_SHEET entries first
- **AND** it MUST include additional character plates (other sheet types) if under the 3-image API limit
- **AND** it MUST load image files from the filesystem as Buffers with correct MIME types
- **AND** it MUST throw an error if a referenced character has no model sheets in the visual reference package.

#### Scenario: Shot image task generates both frame images with system instruction
- **GIVEN** a shot missing one or both image paths
- **WHEN** the task calls the Gemini image client
- **THEN** it MUST load the system instruction from `system_prompts/visual_renderer.md`
- **AND** for the first frame, it MUST pass the shot's `first_frame_prompt` as the user prompt, include character reference images, use 16:9 aspect ratio, save to `shots/<scenelet-id>_shot_<index>_first_frame.png`, and update `first_frame_image_path`
- **AND** for the key frame, it MUST pass the shot's `key_frame_prompt` as the user prompt, include character reference images, use 16:9 aspect ratio, save to `shots/<scenelet-id>_shot_<index>_key_frame.png`, and update `key_frame_image_path`
- **AND** both images MUST use the same character reference images for consistency
- **AND** it MUST update the shot record with both relative paths via the shots repository.

#### Scenario: Shot image task supports resume mode
- **GIVEN** some shots already have one or both images generated
- **WHEN** the task is invoked again
- **THEN** it MUST query the shots repository for shots missing either `first_frame_image_path` or `key_frame_image_path`
- **AND** it MUST only generate the missing images (first frame, key frame, or both)
- **AND** it MUST not regenerate existing shot images unless explicitly requested
- **AND** tests MUST verify partial completion (e.g., first frame exists but key frame missing).

#### Scenario: Shot image task handles missing character references gracefully
- **GIVEN** a shot references a character name that doesn't exist in the visual reference package
- **WHEN** the task attempts to load reference images
- **THEN** it MUST throw a descriptive error identifying the missing character and the problematic shot
- **AND** it MUST not call Gemini or persist incomplete data
- **AND** it MUST log the error for operator visibility.

## MODIFIED Requirements

### Requirement: Task-Based Execution
The workflow MUST expose `runTask` and `runAllTasks` so callers can execute individual tasks or the full sequence.

#### Scenario: Run all tasks sequentially
- **GIVEN** a workflow handle
- **WHEN** `runAllTasks` is invoked
- **THEN** it MUST execute the supported tasks in the defined order (constitution, interactive script, visual design, visual reference, **visual reference images**, audio design, shot production, **shot images**)
- **AND** it MUST surface the final constitution metadata for compatibility with existing callers.

### Requirement: Workflow CLI Exposes New Image Generation Tasks
The workflow CLI MUST allow operators to run the visual reference image and shot image tasks explicitly or as part of the full pipeline in both stub and real Gemini modes.

#### Scenario: CLI runs visual reference image task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_VISUAL_REFERENCE_IMAGES --mode stub`
- **WHEN** the stub Gemini image client is used
- **THEN** it MUST route the call to the workflow `CREATE_VISUAL_REFERENCE_IMAGES` task using stub image data
- **AND** it MUST print success output after persisting the generated image paths.

#### Scenario: CLI runs shot image task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_IMAGES --mode stub`
- **WHEN** the stub Gemini image client is used
- **THEN** it MUST route the call to the workflow `CREATE_SHOT_IMAGES` task using stub image data
- **AND** it MUST print success output after persisting the generated image paths.

#### Scenario: CLI run-all includes image generation tasks
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** the full task pipeline executes
- **THEN** it MUST include `CREATE_VISUAL_REFERENCE_IMAGES` after `CREATE_VISUAL_REFERENCE`
- **AND** it MUST include `CREATE_SHOT_IMAGES` after `CREATE_SHOT_PRODUCTION`
- **AND** it MUST complete without duplicating generated images on repeat invocations.

#### Scenario: CLI supports individual shot image generation
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_IMAGES --scenelet-id scenelet-1 --shot-index 2`
- **WHEN** the task executes with individual mode flags
- **THEN** it MUST generate only the specified shot image
- **AND** it MUST validate that the scenelet and shot index exist before calling Gemini
- **AND** it MUST update only the targeted shot record with the image path.

#### Scenario: CLI supports individual visual reference image generation
- **GIVEN** the CLI is invoked with `run-task --task CREATE_VISUAL_REFERENCE_IMAGES --character-name "Cosmo the Coder" --index 1`
- **WHEN** the task executes with individual mode flags
- **THEN** it MUST generate only the specified character model sheet image
- **AND** it MUST support environment keyframe generation via `--environment-name` and `--index` flags
- **AND** it MUST validate that the specified entry exists in the visual reference package.
