## Why

After the persistence and worker milestones, we can expose mutation controls in the Story Tree UI. Designers need the ability to create stories, trigger workflow tasks, and monitor progress without leaving the browser.

## What Changes
- Add client-side components (task drawer, new story modal, header actions) that call the Story Task APIs and subscribe to realtime updates.
- Implement constitution chat UI that streams task events and refreshes the markdown view when jobs complete.
- Provide optimistic updates for rename/delete operations with clear error recovery when tasks fail.

## Impact
- Requires Supabase Realtime subscriptions and React Query state management in the UI workspace.
- Introduces new UX patterns (drawer, toast notifications) and accompanying component tests.
- Relies on previous milestones for backend capabilities; no additional backend schema or worker changes.
