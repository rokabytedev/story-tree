## MODIFIED Requirements
### Requirement: Provide Shared Player Runtime Module
The shared runtime MUST emit events that let both the standalone and embedded players present identical branching behaviour.

#### Scenario: Runtime emits branch audio events
- **GIVEN** a branching scenelet whose bundle entry includes `branchAudioPath`
- **WHEN** the runtime transitions from the last shot into the branch stage
- **THEN** after the 500 ms ramp-up it MUST emit `branch-audio` with `{ sceneletId, audioPath: branchAudioPath }`
- **AND** it MUST emit `branch-audio-stop` when the user selects a branch, the controller restarts, or playback advances away from the branching scenelet

## ADDED Requirements
### Requirement: Play Branch Audio During Choice Stage
Branching overlays MUST automatically play narrated branch prompts while keeping background music running.

#### Scenario: Branch overlay auto-plays narration after grace period
- **GIVEN** the branch choice UI displays and `branchAudioPath` is not null
- **WHEN** 500 ms have elapsed since the overlay appeared
- **THEN** the player MUST load the referenced audio file and play it once using the existing shot audio element
- **AND** it MUST NOT advance to another scenelet when the audio ends
- **AND** if no branch audio path exists it MUST remain silent without error

#### Scenario: Branch narration stops on choice selection
- **GIVEN** branch narration is playing
- **WHEN** the user selects a branch or the player restarts
- **THEN** the player MUST stop playback immediately and clear the audio source so selection feedback is not overlapped

#### Scenario: Background music continues during branch wait
- **GIVEN** background music is active when a branch overlay appears
- **WHEN** the player enters the choice stage
- **THEN** it MUST keep background music playing and looping at the configured volume while awaiting user input
- **AND** pausing/resuming the story via the toolbar MUST pause/resume both branch narration and background music together
