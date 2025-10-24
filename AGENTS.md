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

## Sub-Agent Workflows

### If this is a sub-agent session
IF the user's original input is in the following format:
```
<sub_agent>
    <type>
        technical_researcher | code_reviewer
    </type>
    <prompt>
        Detailed instruction for the sub-agent
    </prompt>
</sub_agent>
```
THEN: this Codex session is a **Sub-Agent** session

Notes:
- Both `<type>` and `<prompt>` is REQUIRED field
- Tags are case insensitive, e.g. `<type>` and `<TYPE>` are equivalent.
- Empty spaces, newlines, between tags are not important, e.g. the input can be written as below, too:
```
<sub_agent><type>technical_researcher | code_reviewer</type><prompt>Detailed instruction for the sub-agent</prompt></sub_agent>
```

- SWITCH:
- CASE `type=technical_researcher`:
    SUB_AGENT_INSTRUCTION_FILE = `.codex/agents/technical_researcher.md`
- CASE `type=code_reviewer`:
    SUB_AGENT_INSTRUCTION_FILE = `.codex/agents/code_reviewer.md`

Sub-agent workflow:
- Read the whole file and follow strictly the instructions from: SUB_AGENT_INSTRUCTION_FILE
- Replace the `$ARGUMENTS` placeholder in the SUB_AGENT_INSTRUCTION_FILE with the user provided `prompt`
- Start the sub-agent task
- Print progress to stdout console to provide visibility to the caller

**CRITICAL GUIDELINES**:
- To avoid infinite recursive dead loop, a sug-agent directly delegating the same command to another sub-agent, is **STRICTLY FORBIDDEN**
- If the scope of the sub-agent task is too big, you're allowed to split the task into smaller-scoped sub-tasks and invoke corresponding sub-agents for the sub-tasks. You **MUST** conduct carefully considerations before invoking sub-agents from within a sub-agent to avoid **recursion nightmares**

### If this *looks like* a sub-agent session
IF the user's original prompt looks like invoking sub-agent but the `<sub_agent>` block has syntax error:
- Missing any of the required `<type>` or `<prompt>` field
    - The field is absent or has empty value
- Invalid value for the `<type>` field
    - Accepted values are: `technical_researcher` | `code_reviewer`
THEN: respond immediately to the user with meaningful error message

### If this is not a sub-agent session
This is a primary Codex session. You're the **primaray agent**
Follow user's instruction as usual
But you have the **IMPORTANT** responsibility to invoke sub-agent in the following situation

#### Code Review
- Always start the code review process after major code changes
- Never conduct a code review by yourself, the **primary agent**
- Instead, run the following command with a detailed summary of the code changes that need review:
```sh
codex e -s danger-full-access "<sub_agent><type>code_reviewer</type><prompt>detailed summary of code changes</prompt></sub_agent>"
```
- Wait patiently for 10+ minutes as the review may take time to complete
- Read the code review output carefully and address every major issue. If you disagree with a suggestion, pause and request confirmation before proceeding

#### Technical Research
- Start the technical research process for any critical technical decision
    - Search through existing research notes under `research_reports` (and potentially `research_working_notes`) first to if the past research reports had answers already
- Include but not limited to:
    - making engineering design choices
    - solving technical issues
    - identifying technical solutions
    - understanding official API/SDK/library usage, code examples, common patterns, or caveats
    - comparing the pros and cons of technical approaches
    - gathering up-to-date information (e.g. deprecation status)
- Never perform technical research on your own
- Instead, run the following command with a detailed description of the research requirements:
```sh
codex e -s danger-full-access "<sub_agent><type>technical_researcher</type><prompt>details of research requirements</prompt></sub_agent>"
```
- Calibrate the prompt's requested depth—note whether the topic needs a quick scan, standard depth, or exhaustive deep dive based on problem scope and complexity.
- When compiling the research requirements, specifying a specifc version is **STRICTLY FORBIDDEN**
    - E.g. instead of saying "Research the recommended Testing Library setup for a Next.js 14 App Router project"
    - You MUST say "Research the recommended Testing Library setup for a Next.js App Router project"
- Wait patiently for 10+ minutes as the research may take time to complete
- Review the research report carefully and incorporate the findings into your workflow, such as design decisions

## General Guidance
- **Proactively Manage Your Context Window**
    - Compact your context window after major milestones, especially when working on large-scope tasks
- **Dependency Versions**
    - **MOST CRITICAL OVERRIDES ALL OTHER CONFLICTING RULES**
    - Specifying specific version for language, package, library, framework, SDK, API, etc in any documentation (e.g. tasks.md, plan.md, research.md) based on your internal knowledge, which can be out of date, is **STRICTLY FORBIDDEN**. **MUST** leave the version to the package management software to pick the latest LTS / stable / compatible version.

## Tool Use Guidance

### Search Tools
**CRITICAL RULES**:
- Prefer invoking **Technical Research Process** over ad-hoc research when technical needs are non-trivial

#### Potential Use Cases
- fetching up-to-date information—remember your internal knowledge may be outdated
- investigating non-technical questions
- resolving minor external SDK/API/tool errors quickly
- Use `tavily` for general searches that require current information
- Use `context7` for the latest technical documentation
- When uncertain, consult all relevant search tools to gather comprehensive results

### Chrome DevTools MCP
Use the Chrome DevTools to directly debug web pages, identify and resolve issues

Potential use cases include but are not limited to:
- **Real-time Code Verification:** Automatically confirm that generated code fixes work as intended by running them in the browser
- **Error Diagnosis:** Analyze network requests to identify issues like CORS problems and inspect console logs to understand feature malfunctions
- **User Behavior Simulation:** Automate interactions such as navigation, form submissions, and clicks to reproduce bugs and test user flows while monitoring the runtime environment
- **Live Debugging:** Connect to a live page to inspect the DOM and CSS, providing concrete suggestions to fix complex layout and styling problems
- **Automated Performance Audits:** Programmatically run and analyze performance traces to investigate and resolve issues like slow page loads

### Other Tools
- Use `python3` (not `python`) when running ad-hoc Python scripts
