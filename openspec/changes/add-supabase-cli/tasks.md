## 1. Spec Updates
- [x] 1.1 Add story-storage requirement describing the Supabase stories CLI scenarios.

## 2. Implementation
- [x] 2.1 Implement a TypeScript CLI that wraps the stories repository with commands for create and constitution updates.
- [x] 2.2 Wire configuration flags for local vs remote targets and input handling (flags or file) for constitution text.
- [x] 2.3 Document CLI usage in repo (README or dedicated doc) and expose an npm script.

## 3. Validation
- [x] 3.1 Add automated coverage (unit tests or smoke harness) ensuring CLI wiring calls repository with expected arguments.
- [x] 3.2 Manually verify CLI help output and command execution against mocked/local Supabase.
