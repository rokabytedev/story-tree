# story-workflow Spec Deltas

## ADDED Requirements

### Requirement: Generate Shot Audio with Multi-Speaker TTS
The workflow MUST expose a `CREATE_SHOT_AUDIO` task that generates speech audio for shots using Gemini's multi-speaker TTS API based on shot narratives and voice profiles.

#### Scenario: Audio generation task validates prerequisites
- **GIVEN** a workflow handle
- **WHEN** `runTask('CREATE_SHOT_AUDIO')` executes
- **THEN** it MUST throw a descriptive error if the story lacks an audio design document
- **AND** it MUST throw a descriptive error if the story has no generated shots
- **AND** when prerequisites pass it MUST load the audio design document, fetch shots, and proceed with audio generation

#### Scenario: Audio generation uses single-speaker mode for one source
- **GIVEN** a shot with audioAndNarrative entries having only one unique source value (narrator or one character)
- **WHEN** the audio generation task processes the shot
- **THEN** it MUST use Gemini TTS single-speaker mode with model `"gemini-2.5-flash-preview-tts"`
- **AND** it MUST configure the speaker name as the character_id from audio design document
- **AND** it MUST configure the voice name from the matching voice profile's voice_name field
- **AND** it MUST assemble the prompt including only the relevant voice profile and the shot's audioAndNarrative array
- **AND** when `--verbose` flag is enabled it MUST log the full request details (model, prompt, speaker config) without logging binary audio response data

#### Scenario: Audio generation uses multi-speaker mode for two sources
- **GIVEN** a shot with audioAndNarrative entries having exactly two unique source values
- **WHEN** the audio generation task processes the shot
- **THEN** it MUST use Gemini TTS multi-speaker mode with model `"gemini-2.5-flash-preview-tts"`
- **AND** it MUST configure two speaker voice configs with speaker names matching character_id values
- **AND** it MUST use voice_name values from the matching character_voice_profiles in audio design document
- **AND** it MUST include narrator_voice_profile if "narrator" is one of the sources
- **AND** when `--verbose` flag is enabled it MUST log request details with both speaker configurations without logging binary audio response data

#### Scenario: Audio generation rejects shots with three or more speakers
- **GIVEN** a shot with audioAndNarrative entries having three or more unique source values
- **WHEN** the audio generation task processes the shot
- **THEN** it MUST throw a validation error indicating unsupported speaker count
- **AND** it MUST include the shot identifier (scenelet_id and shot_index) in the error message
- **AND** it MUST NOT generate audio for that shot

#### Scenario: Audio generation stores WAV files in public directory
- **GIVEN** Gemini TTS returns audio data for a shot
- **WHEN** the audio generation task saves the file
- **THEN** it MUST save the WAV file to `apps/story-tree-ui/public/generated/<story-id>/shots/<scenelet-id>/<shot-index>_audio.wav`
- **AND** it MUST update the shot's audio_file_path in the database with the relative path `generated/<story-id>/shots/<scenelet-id>/<shot-index>_audio.wav`
- **AND** it MUST create parent directories if they do not exist

#### Scenario: Default mode stops on existing audio
- **GIVEN** the audio generation task runs in default mode (no flags)
- **WHEN** ANY shot in the target scope already has audio_file_path set in the database
- **THEN** the task MUST stop immediately without generating any audio
- **AND** it MUST throw a descriptive error indicating existing audio was found

#### Scenario: Resume mode skips shots with existing audio
- **GIVEN** the audio generation task runs in resume mode (--resume flag)
- **WHEN** the task processes shots
- **THEN** it MUST skip shots that already have audio_file_path set
- **AND** it MUST generate audio only for shots without audio_file_path
- **AND** it MUST log skipped shots for visibility

#### Scenario: Override mode regenerates all shot audio
- **GIVEN** the audio generation task runs in override mode (--override flag)
- **WHEN** the task processes shots
- **THEN** it MUST regenerate audio for ALL shots in the target scope
- **AND** it MUST replace existing audio files and database paths
- **AND** it MUST NOT skip shots with existing audio_file_path

#### Scenario: Batch mode generates audio for entire story
- **GIVEN** the audio generation task is invoked without scenelet-id or shot-index targeting
- **WHEN** the task executes
- **THEN** it MUST fetch all shots for the story grouped by scenelet
- **AND** it MUST process shots sequentially in scenelet_sequence and shot_index order
- **AND** it MUST apply the configured mode (default/resume/override) to all shots

#### Scenario: Single-shot mode generates audio for specific shot
- **GIVEN** the audio generation task is invoked with both --scenelet-id and --shot-index flags
- **WHEN** the task executes
- **THEN** it MUST generate audio only for the shot matching the provided scenelet_id and shot_index
- **AND** it MUST apply the configured mode to that single shot
- **AND** it MUST throw an error if the shot does not exist

#### Scenario: Scenelet batch mode generates audio for one scenelet
- **GIVEN** the audio generation task is invoked with --scenelet-id flag but no --shot-index
- **WHEN** the task executes
- **THEN** it MUST fetch all shots for the specified scenelet
- **AND** it MUST process those shots sequentially by shot_index
- **AND** it MUST apply the configured mode to all shots in that scenelet

### Requirement: Workflow CLI Exposes Shot Audio Task
The workflow CLI MUST allow operators to run the shot audio generation task with mode flags and targeting options in both stub and real Gemini modes.

#### Scenario: CLI runs shot audio task in stub mode
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --mode stub`
- **WHEN** the stub Gemini TTS client is loaded
- **THEN** it MUST route the call to the workflow `CREATE_SHOT_AUDIO` task using stub audio data
- **AND** it MUST save stub WAV files to the public directory
- **AND** it MUST print success output after updating database with audio paths

#### Scenario: CLI supports resume flag for audio generation
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --resume`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST enable resume mode for the audio generation task
- **AND** the task MUST skip shots with existing audio_file_path

#### Scenario: CLI supports override flag as boolean
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --override`
- **WHEN** the CLI parses flags
- **THEN** it MUST interpret --override as a boolean flag without requiring a value
- **AND** it MUST enable override mode for the audio generation task
- **AND** the task MUST regenerate audio for all targeted shots

#### Scenario: CLI supports single-shot targeting
- **GIVEN** the CLI is invoked with `run-task --task CREATE_SHOT_AUDIO --scenelet-id intro-scene --shot-index 2`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST pass both scenelet-id and shot-index to the task options
- **AND** the task MUST generate audio only for that specific shot

#### Scenario: CLI run-all includes shot audio generation
- **GIVEN** the CLI is invoked with `run-all --mode stub`
- **WHEN** the full pipeline executes
- **THEN** it MUST include `CREATE_SHOT_AUDIO` after `CREATE_SHOT_IMAGES`
- **AND** it MUST use stub TTS client for audio generation
- **AND** it MUST complete without errors when audio design document exists

### Requirement: Audio Design Document Schema Updates
The audio design document schema MUST include character_id and voice_name fields in character voice profiles and a top-level narrator_voice_profile field for narrator voice configuration.

#### Scenario: Character voice profiles include character_id
- **GIVEN** an audio design document is generated or loaded
- **WHEN** the audio design response validator processes character_voice_profiles
- **THEN** each profile MUST have a `character_id` field generated using `normalizeNameToId(character_name)` from `visual-design/utils.ts`
- **AND** both `character_id` and `character_name` fields MUST be preserved in the validated document
- **AND** the character_id MUST be used as the speaker name in Gemini TTS API calls

#### Scenario: Character voice profiles include voice_name
- **GIVEN** an audio design document is generated or loaded
- **WHEN** the document's character_voice_profiles array is validated
- **THEN** each profile MUST include a `voice_name` field specifying a Gemini TTS prebuilt voice (e.g., "Kore", "Puck")
- **AND** the voice_name MUST be used in the prebuiltVoiceConfig for Gemini TTS API calls
- **AND** the validator MUST reject profiles missing the voice_name field

#### Scenario: Audio design document includes narrator_voice_profile at top level
- **GIVEN** an audio design document is generated or loaded
- **WHEN** the document structure is validated
- **THEN** it MUST include a `narrator_voice_profile` field at the top level (not in character_voice_profiles array)
- **AND** the narrator_voice_profile MUST include `character_id: "narrator"`, `voice_name`, and `voice_profile` fields
- **AND** the narrator_voice_profile MUST be used when audioAndNarrative includes source: "narrator"
- **AND** the validator MUST reject documents missing narrator_voice_profile or missing required fields

#### Scenario: Audio generation validates voice profile presence
- **GIVEN** a shot references a character_id in its audioAndNarrative
- **WHEN** the audio generation task assembles the TTS prompt
- **THEN** it MUST throw a validation error if no matching character_voice_profile exists
- **AND** it MUST throw a validation error if the profile is missing voice_name or character_id
- **AND** it MUST throw a validation error if narrator is referenced but narrator_voice_profile is missing
