# Constitution

## Core Principles

### I. Test-Driven Development (NON-NEGOTIABLE)
**TDD MUST be followed for all development work.** Every feature begins with tests:
- Write failing tests FIRST (RED)
- Implement minimum code to pass tests (GREEN)
- Refactor while maintaining passing tests (REFACTOR)
- Tests are written at the same time as production code, never deferred
- All RED→GREEN cycles MUST run actual tests; infrastructure or setup issues do NOT excuse skipping test execution

**Rationale**: TDD ensures code quality, prevents regressions, guarantees test coverage, and enables confident refactoring. It is the foundation of sustainable software development.

### II. Simplicity First (KISS + YAGNI)
**Complexity MUST be justified.** Default to the simplest solution that solves the current problem:
- Do NOT over-engineer or build for speculative future needs (YAGNI)
- Prefer clear, straightforward implementations over clever abstractions
- Balance simplicity with extensibility—design should accommodate future changes without major refactoring
- Complexity introduced MUST be documented in design artifacts with explicit justification

**Rationale**: Simple code is easier to understand, maintain, and modify. Premature complexity creates technical debt and slows development.

### III. Single Responsibility & Modularity
**Each component MUST have one reason to change:**
- Functions/methods do one thing well
- Classes encapsulate a single, well-defined responsibility
- Modules have high internal cohesion and low coupling to other modules
- Clear interfaces hide implementation details
- **Separate concerns explicitly**: Isolate pure business logic (the "functional core") from code that interacts with the outside world like databases, APIs, or filesystems (the "imperative shell"). This makes business logic highly testable and reusable.

**Rationale**: Single responsibility makes code predictable, testable, and resilient to change. Modularity enables parallel development and reduces cognitive load.

### IV. Don't Repeat Yourself (DRY)
**Every piece of knowledge or logic MUST have a single, unambiguous representation:**
- Abstract and reuse common logic in functions, classes, or modules.
- Avoid copy-pasting code. Duplication breeds inconsistency and bugs.
- Be cautious of premature abstraction. Abstract only when a clear, stable pattern emerges.

**Rationale**: DRY reduces the risk of inconsistencies, simplifies maintenance, and improves code clarity by centralizing logic.

### V. Code Clarity & Readability
**Code MUST be self-documenting and optimized for human readers:**
- Use descriptive, meaningful names for variables, functions, classes, and modules
- Write code that explains WHAT it does through clear structure
- Use comments sparingly to explain WHY decisions were made, not WHAT code does
- Keep functions and classes small and focused (functions ideally <40 lines)
- Maintain consistent code style per language conventions
- **Limit function arguments**: Functions should have few arguments (ideally 0-2). More than three indicates a potential violation of SRP; consider grouping arguments into a dedicated object.
- **Minimize side effects**: Functions that answer a question (queries) should not change state. Functions that change state (commands) should not return values. This is Command-Query Separation.
- **Maintain a single level of abstraction**: Code within a function should operate at the same conceptual level. Delegate lower-level details to well-named helper functions.
- **Avoid Primitive Obsession**: Represent domain concepts with custom classes or types (e.g., `EmailAddress`, `Money`, `UserID`) instead of generic primitives (`String`, `double`, `int`). This provides type safety and encapsulates domain logic.

**Rationale**: Code is read far more often than written. Clarity reduces onboarding time, debugging effort, and maintenance cost.

### VI. Dependency Management & Abstraction
**Components MUST depend on abstractions, not concrete implementations:**
- Follow Dependency Inversion Principle
- Keep interfaces small and client-specific (Interface Segregation)
- Avoid circular dependencies
- Apply Law of Demeter—components interact only with immediate collaborators
- Favor composition over inheritance for code reuse

**Rationale**: Depending on abstractions reduces coupling, makes systems easier to modify, and improves testability through dependency injection.

### VII. Comprehensive Testing
**Testing MUST provide confidence in correctness:**
- Implement appropriate test types: unit, integration, contract, end-to-end
- Focus tests on behaviors and public APIs, not implementation details
- Achieve high code and branch coverage where it matters
- Tests MUST be fast, isolated, repeatable, self-verifying, and timely (FIRST principles)
- Use fakes/stubs over mocks when possible for higher fidelity
- Integration tests MUST focus on cross-component communication and contract validation

**Rationale**: Comprehensive testing catches bugs early, enables confident refactoring, and serves as executable documentation.

### VIII. Continuous Code Health
**Code health MUST improve over time:**
- Leave code cleaner than you found it (Boy Scout Rule)
- Refactor regularly to reduce technical debt
- Make small, focused commits with clear descriptions
- Address root causes, not symptoms, when debugging
- Remove dead code, update stale comments, fix lint warnings incrementally

**Rationale**: Software entropy increases naturally. Active maintenance prevents degradation and keeps the codebase adaptable.

### IX. Design for Change
**Systems MUST accommodate evolution:**
- Design for extension without modification (Open/Closed Principle)
- Separate concerns into distinct modules
- Use layered abstractions to manage complexity
- Make informed tradeoffs and document reasoning for significant design decisions
- Handle errors gracefully with informative messages

**Rationale**: Requirements change. Systems designed for adaptability reduce the cost of change and extend software lifespan.

## Development Standards

### Code Review Requirements
All code changes MUST be reviewed for:
- **Design**: Sound architecture fitting existing system
- **Functionality**: Correct implementation of requirements with edge cases handled
- **Complexity**: Absence of unnecessary complexity; simpler alternatives preferred
- **Tests**: Adequate test coverage for changes and edge cases
- **Naming**: Clear, descriptive, consistent naming
- **Comments**: Necessary, clear, explaining WHY not WHAT
- **Style**: Strict adherence to language style guides
- **Documentation**: Updates to user/developer docs as needed

Reviews MUST be constructive, specific, and educational. Approve changes that improve code health, even if not perfect.

### Testing Standards
Tests MUST exhibit:
- **Clarity**: Readable, serve as documentation, test public APIs only
- **Completeness**: All necessary context in test body, no hidden dependencies
- **Conciseness**: Only relevant information included
- **Resilience**: Break only when public API behavior changes, not on internal refactoring
- **Fidelity**: Fail when code is broken, use real implementations or fakes over mocks
- **Precision**: Clear failure messages indicating defect location

Use descriptive test names: `featureBeingTested_condition_expectedResult`

Follow Arrange-Act-Assert structure. Avoid logic in tests.

**Code Coverage**:
- Code coverage analysis MUST be set up for all testable code.
- Aim for a code coverage of >80% for all testable code.

### Change Management
Changes MUST be:
- **Small and focused**: Single logical purpose per change
- **Well-described**: Clear commit messages explaining WHAT and WHY
- **Tested**: Accompanied by appropriate tests
- **Reviewed**: Peer-reviewed before merging; proactive code review MUST be initiated after major implementation milestones
- **Documented**: User-facing changes reflected in documentation
- **Committed Proactively**: After code review feedback is addressed, changes MUST be committed proactively
- **Separate refactoring from features**: Submit changes that only refactor code separately from changes that add or modify functionality. A pure refactoring commit should not change any observable behavior.
- **No Backward Compatibility**: Breaking changes MUST remove legacy paths instead of maintaining backward compatibility.

Note: "Major implementation milestone" refers to completion of a significant feature component, architectural change, or substantial refactoring that represents a logical checkpoint in development.

## Quality Gates

### Pre-Implementation Gates
Before coding begins:
- Feature specification MUST be complete without [NEEDS CLARIFICATION] markers
- Technical research MUST resolve all unknowns
- Design MUST pass constitution compliance check
- Contract tests MUST be written and MUST fail
- Integration test scenarios MUST be defined

### Pre-Commit Gates
Before committing code:
- All tests MUST pass
- Code review MUST be completed with feedback addressed
- Linting and formatting checks MUST pass
- Documentation MUST be updated for user-facing changes
- No commented-out code may be committed

### Pre-Merge Gates
Before merging to main:
- All continuous integration checks MUST pass
- Code health MUST improve or remain stable (no degradation)
- Constitutional compliance MUST be verified

## Technology Principles

### Codebase Structure
- The repository root represents the overarching project and MUST remain free of stack-specific runtime code.
- Frontend, backend, data, infrastructure, documentation, and tooling assets MUST live in dedicated subdirectories that follow agreed naming patterns (e.g., `apps/`, `services/`, `packages/`, `docs/`).
- New frameworks or scaffolds MUST be initialized inside their corresponding subdirectories; generators may not be executed from the root.
- Directory names MUST remain concise, descriptive, and consistent with ecosystem best practices to preserve discoverability and portability.

### Version Management
- Use `latest` for framework/SDK/API versions UNLESS a specific version is required
- Document reasoning when pinning versions
- Regularly update dependencies to maintain security and compatibility

### External Dependencies
- Wrap external APIs to isolate API-specific code from domain logic
- Prefer official fakes or real implementations over mocks for external services
- Validate external API usage through contract tests

### Error Handling & Logging
- Error messages MUST be actionable, specific, and include context
- Log with sufficient context for debugging (operation, identifiers, relevant state)
- Structure logs for maintainability and signal-to-noise ratio
- One failure event produces at most one error log entry

## Governance

### Amendment Process
This constitution may be amended when:
1. New principles emerge from team learning and retrospectives
2. Existing principles prove ineffective or counterproductive
3. Technology shifts require updated guidance

Amendments require:
1. Proposal with clear rationale
2. Team discussion and consensus
3. Documentation of change reasoning
4. Update to dependent templates (plan, spec, tasks, agent files)
5. Version increment following semantic versioning

### Version Semantics
- **MAJOR**: Backward-incompatible governance/principle removals or redefinitions
- **MINOR**: New principle/section added or materially expanded guidance
- **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements

### Compliance
- All feature plans MUST include Constitution Check section
- All code reviews MUST verify constitutional compliance
- Violations MUST be justified in Complexity Tracking section of plan.md
- Unjustified violations MUST be rejected with request to simplify approach

### Living Document
This constitution is a living document. Teams are encouraged to:
- Propose improvements based on practical experience
- Challenge principles that hinder productivity
- Share learnings that should be codified
- Keep the constitution relevant and actionable

**Version**: 1.2.0 | **Ratified**: 2025-10-06 | **Last Amended**: 2025-10-14