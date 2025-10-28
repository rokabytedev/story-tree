## MODIFIED Requirements
### Requirement: Trigger Interactive Story Generation
The workflow MUST populate scenelets when the `CREATE_INTERACTIVE_SCRIPT` task runs for a story that already has a constitution.

#### Scenario: Resume completes partially generated trees
- **GIVEN** a story already has persisted scenelets but the workflow is invoked with resume mode enabled
- **WHEN** the interactive script task runs
- **THEN** it MUST inspect the stored scenelets, resume generation for unfinished branches, and exit successfully when the tree is complete
- **AND** it MUST leave existing scenelets untouched.

## ADDED Requirements
### Requirement: Workflow CLI Supports Interactive Script Resume
The workflow CLI MUST let operators request resume mode for the interactive script task.

#### Scenario: CLI forwards resume flag for interactive script task
- **GIVEN** an operator runs `run-task --task CREATE_INTERACTIVE_SCRIPT --resume-interactive-script`
- **WHEN** the CLI prepares workflow options
- **THEN** it MUST enable resume mode on the workflow before invoking the task
- **AND** it MUST surface the task outcome according to normal CLI behaviour.
