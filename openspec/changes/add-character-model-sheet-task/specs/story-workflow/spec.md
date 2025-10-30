# story-workflow Specification Delta

## MODIFIED Requirements

### Requirement: Support Character Model Sheet Generation Task

The story workflow MUST support a CREATE_CHARACTER_MODEL_SHEETS task that generates structured model sheet reference images for story characters.

#### Scenario: Workflow registers character model sheet task type

- **GIVEN** the StoryWorkflow enum of supported tasks
- **WHEN** a client queries available task types
- **THEN** CREATE_CHARACTER_MODEL_SHEETS MUST be included in the StoryWorkflowTask union type
- **AND** the workflow MUST accept this task type in the runTask() method
- **AND** TypeScript compilation MUST enforce exhaustive task type handling

#### Scenario: Workflow invokes character model sheet task runner

- **GIVEN** a story record with a persisted visual design document
- **WHEN** runTask('CREATE_CHARACTER_MODEL_SHEETS') is called
- **THEN** the workflow MUST delegate to runCharacterModelSheetTask with the story ID and configured dependencies
- **AND** the workflow MUST pass through any task-specific options (targetCharacterId, override, resume)
- **AND** the workflow MUST propagate task errors to the caller with context

#### Scenario: Task requires visual design document prerequisite

- **GIVEN** a story record without a visual_design_document
- **WHEN** runTask('CREATE_CHARACTER_MODEL_SHEETS') is invoked
- **THEN** the task runner MUST throw a descriptive error before attempting image generation
- **AND** the error message MUST indicate that CREATE_VISUAL_DESIGN must complete first

#### Scenario: CLI supports character model sheet command

- **GIVEN** the agentWorkflowCli command parser
- **WHEN** a user invokes `run-task --story-id <id> --task CREATE_CHARACTER_MODEL_SHEETS`
- **THEN** the CLI MUST parse the command successfully
- **AND** the CLI MUST support optional `--character-id <id>` flag for single-character targeting
- **AND** the CLI MUST support optional `--override <true|false>` flag (default: false)
- **AND** the CLI MUST support optional `--resume` flag for batch mode
- **AND** the CLI MUST validate that --resume is only used without --character-id
- **AND** the CLI MUST invoke the workflow's runTask method with parsed parameters

#### Scenario: Task integrates with workflow options

- **GIVEN** AgentWorkflowOptions interface
- **WHEN** initializing a workflow with character model sheet dependencies
- **THEN** AgentWorkflowOptions MUST include an optional characterModelSheetTaskOptions field
- **AND** AgentWorkflowOptions MUST include an optional runCharacterModelSheetTask field for dependency injection
- **AND** the options MUST follow the pattern of other task options (visual design, audio design, etc.)
