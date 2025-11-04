## ADDED Requirements
### Requirement: Generate Shot Videos with Veo 3.1
The workflow MUST expose a `CREATE_SHOT_VIDEO` task that produces per-shot MP4 clips using Gemini Veo 3.1 and persists the resulting file paths.

#### Scenario: Video task assembles Veo prompt
- **GIVEN** `runTask('CREATE_SHOT_VIDEO')` executes for a story with storyboard shots
- **WHEN** the task prepares the Veo request
- **THEN** it MUST concatenate the visual design `global_aesthetic`, character designs for referenced characters (excluding `character_model_sheet_image_path`), environment designs for referenced environments (excluding `associated_scenelet_ids` and `environment_reference_image_path`), and the exact shot storyboard payload JSON
- **AND** it MUST append explicit instructions that the video MUST NOT contain captions, subtitles, watermarks, or background music
- **AND** it MUST call Gemini with model `veo-3.1-generate-preview`, aspect ratio `"16:9"`, resolution `"1080p"`, and duration seconds `8`
- **AND** it MUST upload up to three reference images prioritizing (1) character model sheets per referenced character, (2) environment references per referenced environment, (3) the shot key frame image when available
- **AND** it MUST attach those images via the Gemini API `reference_images` configuration with `reference_type: "asset"` for each reference image
- **AND** it MUST persist the returned MP4 via repository `updateShotVideoPath`, storing a relative path such as `generated/<story-id>/shots/<scenelet-id>/shot-<index>.mp4`.

#### Scenario: Video task honours generation modes
- **GIVEN** the workflow prepares `CREATE_SHOT_VIDEO` options
- **WHEN** run in default mode
- **THEN** it MUST throw if any targeted shot already has a `video_file_path`
- **AND WHEN** run in resume mode it MUST skip shots with existing `video_file_path`
- **AND WHEN** run in override mode it MUST regenerate videos for all targeted shots regardless of existing paths
- **AND WHEN** run in dry-run mode it MUST validate inputs, assemble prompts, log planned reference assets, and exit before calling Gemini or writing storage.

#### Scenario: Video task supports shot targeting
- **GIVEN** the task receives `targetSceneletId` and `targetShotIndex`
- **WHEN** both filters are provided
- **THEN** it MUST restrict generation to that exact shot
- **AND** it MUST throw an error if the filtered scope resolves to zero shots in default mode, or when override mode targets a non-existent shot.

### Requirement: Workflow CLI Exposes Shot Video Task
The workflow CLI MUST allow operators to run the shot video task with mode flags, targeting, and stub behaviour.

#### Scenario: CLI dispatches video task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_VIDEO --mode stub`
- **WHEN** the scaffolding loads stub dependencies
- **THEN** it MUST route the call to the workflow task using a stub Gemini video client
- **AND** it MUST save deterministic MP4 fixtures to the generated assets directory and update shot video paths in the database
- **AND** it MUST print a success summary including generated count and skipped shots.

#### Scenario: CLI exposes resume/override flags for video
- **GIVEN** the CLI receives `run-task --task CREATE_SHOT_VIDEO --resume`
- **WHEN** it builds workflow options
- **THEN** it MUST enable resume mode for the video task
- **AND WHEN** the CLI receives `--override` it MUST enable override mode without requiring a value and pass it through to the workflow.

#### Scenario: CLI supports dry-run flag
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_VIDEO --dry-run`
- **WHEN** it parses options
- **THEN** it MUST enable dry-run mode for the video task
- **AND** it MUST prevent combining `--dry-run` with `--override`
- **AND** after execution it MUST report that zero Gemini calls were made while still listing the targeted shots.

#### Scenario: CLI supports scenelet/shot targeting for video
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_VIDEO --scenelet-id intro --shot-index 2`
- **WHEN** it maps flags to workflow options
- **THEN** it MUST pass both values to the video task
- **AND** the task MUST generate (or dry-run) only the specified shot.

### Requirement: Run-All Includes Video Generation
The workflow `runAllTasks()` MUST include the shot video task in the canonical pipeline.

#### Scenario: Full pipeline runs video after images
- **GIVEN** `runAllTasks()` executes
- **WHEN** it iterates the task sequence
- **THEN** it MUST invoke `CREATE_SHOT_VIDEO` immediately after `CREATE_SHOT_IMAGES` and before `CREATE_SHOT_AUDIO`
- **AND** it MUST honour the CLI `--resume` flag and stub mode when present.
