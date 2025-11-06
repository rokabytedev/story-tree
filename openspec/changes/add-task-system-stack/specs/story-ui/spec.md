## ADDED Requirements
### Requirement: Story UI Manages Story Operations via Task System
The Story Tree UI MUST expose controls to mutate stories and surface progress using the shared task infrastructure defined in the `task-orchestration` capability.

#### Scenario: Create story starts asynchronous workflow
- **GIVEN** a user opens the story index
- **WHEN** they submit the “New Story” modal with a prompt
- **THEN** the UI MUST call the Story Task API to enqueue a `CREATE_STORY` operation
- **AND** it MUST display a task progress card showing queued → running → completed states
- **AND** once the task succeeds it MUST insert the new story into the list without requiring a full page reload.

#### Scenario: Constitution chat shows streaming updates
- **GIVEN** a user opens the Constitution tab for a story
- **WHEN** they send a constitution revision request through the chat panel
- **THEN** the UI MUST stream `chat_message` and `progress` events from the task drawer in real time
- **AND** once the task finishes it MUST refresh the rendered constitution markdown with the updated content.

#### Scenario: Rename and delete propagate immediately
- **GIVEN** a user triggers Rename or Delete from the story detail header
- **WHEN** the API reports the task as succeeded
- **THEN** the UI MUST optimistically update the story title or remove the story entry
- **AND** it MUST reconcile state if the task transitions to failed by restoring the previous title or re-inserting the deleted card with an error banner.
