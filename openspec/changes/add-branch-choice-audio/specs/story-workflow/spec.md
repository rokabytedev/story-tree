## MODIFIED Requirements
### Requirement: Generate Shot Audio with Multi-Speaker TTS
The workflow MUST expose a `CREATE_SHOT_AUDIO` task that generates speech audio for shots and branching prompts using Gemini's TTS API based on stored narratives and voice profiles.

#### Scenario: Audio generation task builds branch narration queue
- **GIVEN** `runTask('CREATE_SHOT_AUDIO')` executes for a story with branching scenelets
- **WHEN** prerequisites pass
- **THEN** after processing targeted shots it MUST iterate each branching scenelet in scope
- **AND** it MUST skip branch points lacking a choicePrompt or fewer than two choice labels by setting the scenelet's branch audio path to `SKIPPED_AUDIO_PLACEHOLDER` and logging a warning

#### Scenario: Branch narration uses narrator voice profile
- **GIVEN** a branching scenelet with a choice prompt and labels
- **WHEN** the task assembles the Gemini request
- **THEN** it MUST build a narrator-only script that reads the prompt followed by each choice separated by "or"
- **AND** it MUST call Gemini TTS in single-speaker mode using `narrator_voice_profile.voice_name`
- **AND** it MUST include an inviting delivery cue (e.g. "curious, welcoming narrator") in the prompt payload

#### Scenario: Branch narration stores WAV files in branches directory
- **GIVEN** Gemini TTS returns audio data for a branching scenelet
- **WHEN** the task saves the file
- **THEN** it MUST write the WAV to `apps/story-tree-ui/public/generated/<story-id>/branches/<scenelet-id>/branch_audio.wav`
- **AND** it MUST update the scenelet's `branch_audio_file_path` to `generated/<story-id>/branches/<scenelet-id>/branch_audio.wav`
- **AND** it MUST create parent directories when they are missing

#### Scenario: Branch narration respects mode flags
- **GIVEN** the task targets branching scenelets
- **WHEN** running in default mode
- **THEN** it MUST throw if ANY targeted branch already has a non-placeholder audio path
- **AND** in resume mode it MUST skip branches with existing audio paths
- **AND** in override mode it MUST regenerate and overwrite branch audio regardless of existing paths

### Requirement: Bundle JSON transforms scenelets to flat array
Branching scenelets MUST surface their narrator audio path in the exported bundle.

#### Scenario: Bundle JSON exposes branch audio path
- **GIVEN** the bundle assembler processes a branching scenelet with `branch_audio_file_path`
- **WHEN** it builds the `SceneletNode`
- **THEN** it MUST include `branchAudioPath: "assets/branches/<scenelet-id>/branch_audio.wav"`
- **AND** it MUST set `branchAudioPath` to null when the scenelet path is NULL or `SKIPPED_AUDIO_PLACEHOLDER`
- **AND** non-branching scenelets MUST always have `branchAudioPath` null

### Requirement: Copy Generated Assets to Output Folder
The bundle task MUST copy branch narration files alongside shot assets.

#### Scenario: Task copies branch audio to output folder
- **GIVEN** a story with branching scenelets whose `branch_audio_file_path` points to an existing file
- **WHEN** the asset copier runs
- **THEN** it MUST copy each file from `public/generated/<story-id>/branches/<scenelet-id>/branch_audio.wav`
- **AND** it MUST copy to `/output/stories/<story-id>/assets/branches/<scenelet-id>/branch_audio.wav`
- **AND** it MUST create the `assets/branches/<scenelet-id>/` directory when missing

#### Scenario: Task handles missing branch audio gracefully
- **GIVEN** a branching scenelet has `branch_audio_file_path` set but the source file is missing
- **WHEN** the asset copier runs
- **THEN** it MUST log a warning that identifies the scenelet id and missing path
- **AND** it MUST skip copying without throwing
- **AND** it MUST set the scenelet's `branchAudioPath` to null in the resulting bundle JSON
