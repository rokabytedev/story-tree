<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

**Project Constitution:** `constitution.md`

## General Guidance
- **Proactively Manage Your Context Window**
    - Compact your context window after major milestones, especially when working on large-scope tasks

## Tool Use Guidance
### Search Tools
- fetching up-to-date information—remember your internal knowledge may be outdated
- investigating non-technical questions
- resolving minor external SDK/API/tool errors quickly
- Use `tavily` for general searches that require current information
- Use `context7` for the latest technical documentation
- When uncertain, consult all relevant search tools to gather comprehensive results
