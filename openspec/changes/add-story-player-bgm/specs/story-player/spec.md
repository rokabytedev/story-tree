## ADDED Requirements
### Requirement: Bundle Background Music Assets
The player bundle MUST package background music cue files so the standalone player can load them.

#### Scenario: Copy cue audio into bundle
- **GIVEN** the bundle task is assembling assets for a story
- **WHEN** a cue in `audioDesignDocument.music_and_ambience_cues` references `cue_name` "Moonlight"
- **THEN** the file `public/generated/<story-id>/music/Moonlight.m4a` MUST be copied into the bundle output
- **AND** the player JSON MUST map the cue to its associated scenelet IDs.

#### Scenario: Missing cue file logs warning
- **GIVEN** a cue is listed in `music_and_ambience_cues`
- **WHEN** the corresponding `.m4a` file is absent
- **THEN** the bundle task MUST log a warning identifying the missing cue
- **AND** it MUST continue generating the bundle without throwing an error.

### Requirement: Background Music Playback
The standalone player MUST play bundled music cues with smooth transitions aligned to scenelet progression.

#### Scenario: Start cue when entering first associated scenelet
- **GIVEN** playback enters a scenelet listed under cue "Moonlight"
- **WHEN** the previous cue differs or no cue was active
- **THEN** the player MUST start playing `music/Moonlight.m4a`
- **AND** it MUST use a configurable volume constant for music playback.

#### Scenario: Continue cue across consecutive scenelets
- **GIVEN** playback remains within scenelets associated to the currently playing cue
- **WHEN** advancing to the next scenelet in that cue's list
- **THEN** the player MUST keep the cue playing without restarting from the beginning.

#### Scenario: Cross-fade between cues
- **GIVEN** playback moves from a scenelet using cue "Moonlight" to one using cue "Sunrise"
- **WHEN** the transition occurs
- **THEN** the player MUST cross-fade between the two tracks using a configurable duration (default 0.5s)
- **AND** both audio elements MUST respect the configured volume constant.

#### Scenario: Warn for non-consecutive cue mapping
- **GIVEN** a cue is mapped to non-consecutive scenelet IDs
- **WHEN** playback reaches a gap in the cue's coverage
- **THEN** the player MUST log a warning indicating the cue spans non-consecutive scenelets
- **AND** it MUST fall back to stopping the cue at the gap without crashing.

#### Scenario: Skip music when cue unavailable
- **GIVEN** playback enters a scenelet without a mapped cue or with a missing file
- **WHEN** the player determines no cue is available
- **THEN** it MUST play no background music
- **AND** it MUST continue shot playback normally.
