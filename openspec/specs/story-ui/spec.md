# story-ui Specification

## Purpose
TBD - created by archiving change add-story-tree-ui-shell. Update Purpose after archive.
## Requirements
### Requirement: Provide Story Tree UI Workspace
The project MUST expose a standalone Story Tree UI workspace built with Next.js, React, TypeScript, and TailwindCSS.

#### Scenario: UI workspace builds independently
- **GIVEN** project dependencies are installed at the repository root
- **WHEN** a developer runs the UI workspace build script
- **THEN** the build MUST complete without depending on backend packages
- **AND** it MUST output a Next.js bundle that includes the shared theme tokens.

### Requirement: Render Story Explorer Shell
The Story Tree UI MUST present a left-aligned vertical navigation shell that mirrors the storyboard mock aesthetic.

#### Scenario: Story detail page shows vertical tab layout
- **GIVEN** a user opens `/story/sample-story-id/constitution`
- **WHEN** the page renders
- **THEN** the sidebar MUST span the viewport height, display Story Tree branding, and list the Constitution, Script, Storyboard, Visual, and Audio tabs with icons
- **AND** the main canvas area MUST occupy the remaining width with the configured theme styling.

### Requirement: Render Story Artifact Tabs
The Story Tree UI MUST render placeholder content for each story artifact using mocked data while backend APIs are unavailable.

#### Scenario: Tabs show artifact placeholders
- **GIVEN** mocked constitution, script, visual, visual reference, and audio documents are available
- **WHEN** the user switches between tabs in the story detail view
- **THEN** the Constitution tab MUST render markdown text, Script MUST render YAML, Visual and Audio MUST render JSON, and Storyboard MUST display an empty-state panel describing forthcoming visualization work.

### Requirement: Support URL-Based Navigation
The Story Tree UI MUST rely on URL routes to reflect the active story and tab selection.

#### Scenario: Routes map to tab state
- **GIVEN** the user navigates to `/story/sample-story-id/visual`
- **WHEN** the page loads
- **THEN** the Visual tab MUST be selected in the sidebar
- **AND** switching to any other tab MUST update the URL to the corresponding path without a full page refresh.

### Requirement: Ensure Accessible Navigation Baseline
The Story Tree UI MUST satisfy baseline accessibility for navigation and content placeholders.

#### Scenario: Sidebar navigation supports keyboard and screen readers
- **GIVEN** the user focuses the sidebar using the keyboard
- **WHEN** they press arrow or tab keys to move between tabs
- **THEN** focus MUST move sequentially with visible outlines
- **AND** the active tab MUST expose an accessible name and `aria-current` state so screen readers announce the selection.

