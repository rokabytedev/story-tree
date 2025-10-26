## ADDED Requirements
### Requirement: Depth-First Interactive Story Generation
The backend MUST expose a pure orchestration function that expands a story tree by exploring Gemini-generated scenelets depth-first using a stack of pending generation tasks.

#### Scenario: DFS stack advances story paths
- **GIVEN** a story id, story constitution, and empty scenelet repository
- **WHEN** the orchestrator runs
- **THEN** it MUST push the root task onto a stack, repeatedly pop tasks, and append new tasks for each generated child so that one branch is explored to completion before backtracking
- **AND** it MUST persist each scenelet through the storage layer with the resolved parent id before scheduling follow-up tasks.

### Requirement: Branch and Conclusion Handling
The generator MUST interpret Gemini responses to continue linearly, branch into choices, or conclude a path, and persist corresponding metadata.

#### Scenario: Branch response spawns multiple tasks
- **GIVEN** Gemini returns a response with `branch_point: true`
- **WHEN** the generator processes the payload
- **THEN** it MUST mark the parent scenelet as a branch point with the provided `choice_prompt`
- **AND** it MUST persist each choice scenelet with its `choice_label`
- **AND** it MUST push separate tasks for each choice so the DFS traversal eventually explores both paths.

#### Scenario: Concluding response ends path
- **GIVEN** Gemini marks `is_concluding_scene: true`
- **WHEN** the generator saves the concluding scenelet
- **THEN** it MUST flag the scenelet as terminal in storage
- **AND** it MUST avoid pushing additional tasks for that branch.

### Requirement: Gemini Interactive Scriptwriter Invocation
The generator MUST call Gemini with the `system_prompts/interactive_scriptwriter.md` prompt, the current path context, and an instruction that distinguishes the root versus continuation scenelets.

#### Scenario: Prompt formatted for root and continuation
- **GIVEN** the orchestrator prepares a Gemini request
- **WHEN** the task has no prior scenelets
- **THEN** it MUST issue user content that includes the story constitution and a root instruction without a current path section
- **AND** when prior scenelets exist it MUST include the serialized path context and a continuation instruction so Gemini receives the full narrative history.

### Requirement: Robust Gemini Response Validation
The generator MUST validate Gemini JSON before attempting persistence and surface descriptive errors when payloads are malformed or missing required fields.

#### Scenario: Malformed Gemini payload triggers error
- **GIVEN** Gemini returns text that cannot be parsed as the expected JSON schema
- **WHEN** the orchestrator attempts to process it
- **THEN** it MUST throw an error that identifies the interactive script generation operation and includes the raw response text for debugging (with secrets redacted).
