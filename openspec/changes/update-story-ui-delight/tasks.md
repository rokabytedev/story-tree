# Implementation Tasks

## Milestone 1 – Theme & Layout Foundation
- [ ] Replace existing CSS color variables in `apps/story-tree-ui/src/app/globals.css` with the new pastel palette and expose companion Tailwind tokens for background, surface, border, highlight, and text colors.
- [ ] Audit shared components for hard-coded hex values and swap them to the refreshed Tailwind tokens.
- [ ] Rework `/story/[storyId]/layout.tsx` so the sidebar is sticky on desktop, the main panel fills the viewport height, and the legacy header/accent dot is removed.

## Milestone 2 – Sidebar Navigation Experience
- [ ] Build a sidebar header component that renders the home control, story thumbnail (with placeholder fallback), title, and author; mount it above the tab navigation.
- [ ] Replace custom SVG icons with Heroicons outline components and feed them consistent sizing/aria labels.
- [ ] Update tab description copy to the new messaging and ensure layout accommodates the longer text.

## Milestone 3 – Constitution & Content Rendering
- [ ] Introduce `react-markdown` with `remark-gfm` in `MarkdownPreview` to support headings, emphasis, links, lists, blockquotes, and inline code with theme-aware typography classes.
- [ ] Adjust constitution tab wrapper to drop the legacy heading block and rely on sidebar context while keeping empty/error states intact.

## Milestone 4 – Visual Tab Rewrite
- [ ] Add type guards/utilities to coerce `visualDesignDocument` into structured character and environment models that surface `character_model_sheet_image_path` and `environment_reference_image_path`.
- [ ] Redesign character and environment sections to show a single primary image, metadata panels, and clear empty states when paths are missing.
- [ ] Remove dependencies on `visual_reference_package` and dead code paths no longer reachable after the schema change.

## Milestone 5 – Story Catalog Enhancements
- [ ] Extend `getStoryList`/`getStory` (and their view models) to compute `thumbnailImagePath` from the earliest shot with a key frame image and extract the logline from constitution Markdown.
- [ ] Update the story list page to display the thumbnail, story title, and logline with responsive layout and placeholder art when data is missing.

## Milestone 6 – Audio Tab Experience
- [ ] Introduce data mappers/guards that convert `audioDesignDocument` into typed sections (sonic identity, narrator profile, character profiles, music cues) while preserving the raw JSON artifact for reference.
- [ ] Build UI sections that surface sonic identity insights and voice profiles with palette-aligned badges or cards before the cue list.
- [ ] Implement a cue playlist component that renders each `music_and_ambience_cues` entry with play/pause controls tied to story-local audio files, including empty-state messaging when files are missing.
- [ ] Add a shared playback controller ensuring only one cue plays at a time and exposing playback state to the UI (e.g. "Now playing").
