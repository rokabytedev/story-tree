## ADDED Requirements
### Requirement: Story UI Consumes Task Infrastructure
The Story Tree UI MUST use the new task system to expose story creation and maintenance controls.

#### Scenario: Create story modal enqueues task
- **GIVEN** a user submits the New Story modal
- **WHEN** the form posts to the Story Task API
- **THEN** the UI MUST display queued → running → completed states and append the new story to the list when the task succeeds without forcing a full refresh.

#### Scenario: Rename and delete actions stay in sync
- **GIVEN** a user renames or deletes a story from the detail header
- **WHEN** the corresponding task succeeds or fails
- **THEN** the UI MUST optimistically update the view and roll back with an error banner if the task reports failure via realtime updates.

#### Scenario: Constitution chat streams updates
- **GIVEN** a user starts a constitution chat revision
- **WHEN** the task emits `chat_message` events
- **THEN** the UI MUST stream them live in the chat panel and reload the constitution markdown once the task completes successfully.
