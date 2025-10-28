goal:
- bootstrap nextjs, reactjs, tailwindcss etc modern web app stack
- create the web app project under its own separate folder. DO NOT create under root directory
- create ui skeleton for the web app ("Story Tree")
    - define a centralized "theme" (font, color palette, etc) that will be used across the app
    - basic navigation (url based)
    - basic pages setup

the web app is a single page app with a tab based navigation
- tab bar on the most left of the page takes full height of the page
- placeholder tabs for now: "Constitution", "Script", "Storyboard", "Visual", "Audio". all with proper icon and text.
- the main area is the "canvas". it shows different type of content for different tab.
    - Constitution tab: the story constitution markdown text (ok to be raw text for now)
    - Script tab: the story tree snapshot YAML text (ok to be raw text for now)
    - Storyboard tab: leave it empty for now. will render a binary tree diagram later
    - Visual tab: the json content for the visual design and the visual reference package (ok to be raw json text for now)
    - Audio tab: the json content for the audio design (ok to be raw json text for now)

refer to ui_mocks/storyboard.png and ui_mocks/storyboard.html for the visual design styling for the overall page feel and the side panel (tab bar).

the web app routing should follow url based rule like the following (just my initial thoughts. you design the final scheme):
- https://domain.com/story/story-id-xxx/constitution -> constitution tab
- https://domain.com/story/story-id-xxx/storyboard -> storyboard tab
- https://domain.com/story -> the index page of list of stories and new story button etc
navigation should feel like it's single page app instead of full page refresh, if it's possible and follows next.js app convention. low priority if it's a lot of work to implement.

for ui related feature, especially for visual elements, relax the TDD and testing requirements. it's lower priority, unless it's for unit testing some core business logic in ui layer which should happen rarely.

your task:
- read this doc and understand my intent
- expand this doc to be a full requirement doc (let me review before continue)
- split the scope into manageable milestone
- kick off openspec process for the spec documentations (let me review before continue)
- start the implementation of the first milestone
- let me review before continue with more milestones

# Story Tree UI Bootstrap Requirements

## Overview
Story Tree needs a standalone web UI that lets storytellers browse story assets produced by the agent workflow. This effort bootstraps a modern Next.js + React + Tailwind stack, establishes shared theming, and delivers an initial single-page experience with tabbed navigation and placeholder content for each artifact type (constitution, script, storyboard, visual, audio). The work should align with existing backend specifications so that future integrations can bind real data with minimal rework.

## Goals
- Stand up a production-ready Next.js application with React, TypeScript, TailwindCSS, and supporting tooling (linting, formatting, commit hooks if available).
- Host the UI in its own dedicated workspace path (e.g. `apps/story-tree-ui/`) rather than the project root.
- Establish a centralized theme system (palette, typography, spacing, iconography guidelines) reusable across components.
- Implement tab-based navigation that matches the `ui_mocks/storyboard.png` feel: vertical tab bar pinned to the left, full-height layout, and a canvas area that swaps content per tab.
- Provide placeholder renders for existing story artifacts (constitution Markdown, interactive script YAML, visual design JSON, visual reference JSON, audio design JSON) and leave a storyboard canvas placeholder for future visualization work.

## Non-Goals
- Building the interactive storyboard visualization or other rich editors.
- Wiring live Supabase or workflow data; the milestone delivers static or mocked payloads until APIs are available.
- Introducing comprehensive UI test coverage; smoke-level checks are sufficient for the bootstrap.

## Constraints & Assumptions
- Follow Next.js App Router conventions unless a compelling reason dictates otherwise.
- Prefer Tailwind utility classes with a thin layer of design tokens (CSS variables or Tailwind theme extensions).
- Use Heroicons or another lightweight icon set already cleared for reuse; do not add heavy icon libraries without review.
- Navigation should feel SPA-like by using Next.js `Link` or router hooks to prevent full refreshes.
- Keep dependencies minimal; avoid adopting component libraries until we validate requirements.

## Functional Requirements

### Project Structure
- The web UI MUST live under a new top-level directory (e.g. `apps/story-tree-ui/`) with its own `package.json`, build scripts, and README.
- The root repository MUST treat the UI as a separate workspace (npm/yarn/pnpm workspace entry) without polluting backend dependencies.
- The new app MUST ship with runnable scripts: `dev`, `build`, `start`, and `lint`.

### Theme System
- Define global styling tokens (font families, primary/secondary palette, background, surface, accent colors) in a single source (Tailwind config + CSS variables).
- Apply the theme to baseline elements: body background, global typography, default button/link styles, and panel surfaces.
- Provide light-only mode for now, but document how dark mode would extend the theme.

### Layout & Navigation
- The app shell MUST render a fixed left sidebar that spans the viewport height and width defined in the mocks, with Story Tree branding at the top.
- Sidebar MUST expose five primary tabs—Constitution, Script, Storyboard, Visual, Audio—each with icon + text and clear selected/hover states.
- The main canvas area MUST occupy the remaining width, support vertical scrolling, and adapt gracefully at 1280px width and above. Behaviour at ~1024px should remain usable (sidebar collapsible in later milestones if needed).
- Switching tabs MUST update both the highlighted navigation state and the rendered canvas content without a full page reload.

### Tab Content Placeholders
- **Constitution Tab**: render markdown content using a basic Markdown component with the raw constitution text (fallback to static fixture).
- **Script Tab**: display YAML text in a syntax-highlighted code block or monospace container.
- **Storyboard Tab**: render an empty state panel describing upcoming storyboard visualization work (include CTA or note).
- **Visual Tab**: display formatted JSON for the visual design document with collapsible sections if practical; raw text is acceptable for bootstrap.
- **Audio Tab**: display formatted JSON for the audio design document similar to Visual tab.
- Provide a default story payload (static JSON file or mock fetch) that feeds the tabs; plumb hooks so real data can replace mocks later.

### Routing Behaviour
- Define route structure following `/story`, `/story/[storyId]/constitution`, `/story/[storyId]/script`, `/story/[storyId]/storyboard`, `/story/[storyId]/visual`, `/story/[storyId]/audio`.
- Landing page `/story` MUST list available stories (static mock cards + “Create New Story” CTA) and allow navigating into a story detail with client-side routing.
- Navigating between tabs MUST update the URL to the corresponding path to support deep links and browser history.
- Unknown routes under `/story` MUST redirect or show a 404 aligned with Next.js defaults.

### Accessibility & Quality
- Sidebar navigation MUST be keyboard accessible (tab order, focus outlines, `aria-current` on selected tab).
- Icons MUST include accessible labels for screen readers.
- Adhere to Tailwind best practices to maintain responsive layout; document any custom utility classes added.
- Include a smoke-level integration test (Playwright or Cypress) OR a Storybook story validating the tab navigation, whichever is lighter-weight during bootstrap.

## Implementation Milestones
1. **Milestone 1 – Project Bootstrap & Theme**
   - Scaffold Next.js + TypeScript + Tailwind app under new workspace directory.
   - Configure base theme tokens and global styles; wire linting/formatting scripts.
   - Add placeholder data sources (static JSON/YAML files) for story artifacts.

2. **Milestone 2 – Shell & Navigation**
   - Implement layout shell with left sidebar, branding, and tab navigation.
   - Hook navigation to Next.js routing and ensure SPA-like transitions.
   - Ensure responsive behaviour at target desktop widths and keyboard accessibility.

3. **Milestone 3 – Canvas Content & Routing**
   - Render placeholder content for each tab using the static artifact data.
   - Implement `/story` list page with mock data and link to story detail routes.
   - Add minimal smoke test or Storybook coverage validating tab switching.

4. **Milestone 4 – Polish & Handoff (Optional / Future)**
   - Document theming tokens and component structure in README.
   - Prepare integration notes for wiring live Supabase-backed story data.
   - Capture open questions or backlog items (sidebar collapse, dark mode, etc.).

## Risks & Open Questions
- Need confirmation on final workspace naming conventions (e.g. `apps/` vs `packages/`).
- Icon library preference pending—defaulting to Heroicons unless directed otherwise.
- Determine whether Playwright or Storybook is preferred for smoke validation.

## References
- `ui_mocks/storyboard.png` and `ui_mocks/storyboard.html` for desired aesthetic.
- Backend specs: `openspec/specs/story-workflow/spec.md`, `openspec/specs/visual-design/spec.md`, `openspec/specs/visual-reference/spec.md` for artifact structure alignment.
- `constitution.md` for program-wide guidelines.
