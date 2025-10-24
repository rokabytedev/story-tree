## 1. Research & Planning
- [ ] 1.1 Run the `technical_researcher` sub-agent to capture the latest recommended Node.js integration patterns for Gemini (models, thinking config, timeout support, JSON responses).
- [ ] 1.2 Finalise the shared Gemini client factory, story constitution module surface, return type, and error taxonomy based on the research findings.
- [ ] 1.3 Confirm directory naming and structure for the new `agent-backend/` workspace.

## 2. Implementation
- [ ] 2.1 Scaffold the `agent-backend/` directory with appropriate TypeScript setup.
- [ ] 2.2 Add the shared Gemini client factory that centralises model name, timeout, thinking budget, and error mapping.
- [ ] 2.3 Implement the Story Constitution generator function that uses the factory, loads the system prompt, and parses the JSON response.
- [ ] 2.4 Create a developer CLI utility capable of invoking the story constitution workflow with a user-provided brief.
- [ ] 2.5 Add unit tests using faked Gemini responses covering success, malformed JSON, and rate-limit failures (no live API calls).
- [ ] 2.6 Document required environment variables and configuration in the appropriate README or developer guide if missing.

## 3. Validation
- [ ] 3.1 Run the automated test suite and linting relevant to the new module.
- [ ] 3.2 Manually exercise the CLI utility against stubbed responses to verify developer workflow.
- [ ] 3.3 Update this checklist to reflect completion and ensure spec compliance.
