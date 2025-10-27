## Tasks
- [x] Update workflow task types and sequencing to include `CREATE_AUDIO_DESIGN` with prerequisite checks.
- [x] Implement Gemini prompt builder and snapshot tests for the audio design request.
- [x] Implement response validator enforcing character name and scenelet id integrity, with unit coverage.
- [x] Wire the workflow task to call Gemini, persist the audio design document, and add workflow/integration tests.
- [x] Add CLI support, stub fixtures compatible with existing run-all stubs, and update CLI tests for both stub and real modes.
- [x] Run `openspec validate add-audio-design-task --strict` and fix any reported issues.
