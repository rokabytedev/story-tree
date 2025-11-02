## Why
- The current Story Tree workspace ships a dark, high-contrast palette that clashes with the requested "delightful children storybook" aesthetic and makes future reskin work difficult because the hues are hard-coded in CSS variables.
- Constitution content renders as lightly formatted text, so headings, emphasis, and bullet structure from the generated Markdown are lost and the page reads like raw prose.
- The story detail layout duplicates story context in the header, buries navigation under a scrollable sidebar, and surfaces placeholder copy/icons that no longer convey the purpose of each tab.
- Visual exploration regressed after the visual reference package was deprecated: the Visual tab still expects multi-image grids tied to `visual_reference_package` instead of the single-image paths stored on `visual_design_document` entries.
- The story list view does not preview artwork or the story logline, so users cannot quickly scan the catalog or recognize individual productions.

## What Changes
- Introduce a pastel storybook theme palette stored in the shared theme tokens so background, surfaces, borders, highlights, and typography adopt the new colors and remain swappable.
- Rework the story detail shell so the sidebar is fixed, houses a home navigation control, renders the story thumbnail and title in a header block, and presents tab descriptions that explain each artifact with iconography sourced from a shared icon library.
- Update the Constitution tab to render rich Markdown (headings, emphasis, lists, links, blockquotes) with accessible typography instead of manual parsing.
- Refresh the main content frame so the working canvas uses the full viewport height, removes the accent dot, and keeps contextual chrome (title, thumbnail, navigation) inside the sidebar on large screens.
- Adapt the Visual tab to read character and environment metadata from `visual_design_document`, displaying the single model sheet or environment reference image plus structured metadata for each entry with graceful fallbacks when images are missing.
- Redesign the Audio tab to foreground sonic identity, voice profiles, and a cue playlist with inline playback controls while keeping the raw JSON artifact accessible for reference.
- Enhance the story list page to pull the first available shot image per story for thumbnails, extract the constitution logline for a synopsis line, and present the information in a consistent card layout.

## Impact
- Requires updating shared Tailwind tokens, CSS variables, and potentially adding design-time utilities to propagate the new palette; downstream components must consume the tokens instead of hard-coded values.
- Adds runtime dependencies for Markdown rendering and iconography (e.g. `react-markdown`, `@heroicons/react`), which increases bundle size slightly but keeps implementation maintainable.
- Audio tab work introduces lightweight audio player helpers to coordinate exclusive playback and may add UI primitives for cue cards.
- Story fetching logic must assemble additional data (first shot image path, logline parsing) and handle empty states without breaking existing API contracts.
- Visual tab components must refactor to the new document shape, including defensive handling for missing image paths and updated typing to avoid runtime failures.
