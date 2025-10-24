## Why
- The interactive storybook agent needs a foundational capability to turn a short user brief into a structured Story Constitution before downstream generation work can begin.
- We must integrate the Gemini API using the dedicated story constitution system prompt so the workflow can reliably bootstrap each project.
- The agent infrastructure needs clear error signalling when Gemini rate limits so upstream schedulers can retry without guessing.

## What Changes
- Stand up a new root-level `agent-backend/` workspace for agentic workflow workers, housing shared Gemini utilities and story constitution logic.
- Introduce a shared Gemini client factory in `agent-backend/` that centralises configuration (model name, timeout, thinking budget) and loads the `story_constitution` system prompt as needed.
- Implement a TypeScript function that accepts a short story brief, invokes Gemini with the `story_constitution` system prompt via the shared client, and returns the parsed JSON payload described in the prompt.
- Ensure rate-limit responses surface as a retryable error type while other failures propagate with actionable context.
- Add unit tests that exercise the shell logic with faked Gemini responses (no live calls) and a developer CLI utility for manually invoking the story constitution workflow.

## Impact
- Requires `GEMINI_API_KEY` to be present in the environment for automated runs and local testing.
- Introduces longer-running network calls; callers must be prepared for multi-minute waits.
- Creates a reusable Gemini client surface that later prompts (e.g. outline, scene scripts, visuals) can share.
- No schema or storage changes.

## Open Questions
- Do we need a shared Gemini client factory now or defer until a second capability lands?
    - Yes for now.
- Should we introduce lightweight rate-limit backoff policy in this change or leave retry orchestration to higher layers?
    - Not at this layer. Retry logic will be handled at higher level and will be implemented later.
- Source code path
    - `src/ai/` is bad. All agentic workflow codes should be in its own directory under root. This will be the backend worker (not web worker / web api) related code / logic. Give the directory a proper name.
- Testing
    - The implementation code should try to separate concerns (shell vs business logic). But in this case, this is probably pretty much all shell code (e.g. IO / external API call)? making it hard to do TDD. So TDD requirement can be relaxed a bit for shell code. The unit test should never rely on calling real Gemini API.
    - Create a testing util script CLI for me to manually invoke the story constitution function. The CLI will be later extended to support manul testing other workflows as well. But for now, the only capability will be testing story constitution creation with a user story brief as input.

## Constitution Check
- We will write tests around the shell logic using faked Gemini responses, acknowledging that strict red-green TDD is relaxed for pure IO wrappers.
- Scope is minimal and targeted at a single capability to honour simplicity and SRP.
