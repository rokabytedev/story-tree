# Design: Story Tree UI Delight Refresh

## Overview
The Story Tree workspace needs a friendly, storybook-inspired skin, richer artifact navigation, and alignment with the new visual design data contracts. This design describes how the Next.js UI, shared theme tokens, and server data mappers will evolve to meet the requested UX updates without disrupting existing routes.

## Architecture

### Theme Tokens
- Define dreamcore pastel palette in `src/app/globals.css` as CSS variables (`--color-page`, `--color-surface`, etc.) using the provided hex values.
- Extend Tailwind config to expose complementary utility tokens (e.g. `surface-elevated`, `accent-muted`) for components that need secondary shades.
- Document palette mapping in a dedicated `theme` module exporting both the CSS variable assignments and a TypeScript object so components can reuse the palette when inline styles are required (e.g. dynamic gradients).

### Layout Updates
- Keep `/story/[storyId]/layout.tsx` as the single layout wrapper but restructure markup:
  - Sidebar: fixed column (`lg:sticky lg:top-0 lg:h-screen`) with scroll only inside the navigation container.
  - Header block inside sidebar showing home button, thumbnail, story title, optional author; navigation tabs follow immediately.
  - Main panel: remove story title header, use flex column with full-height scroll region for tab content.
- Introduce `StorySidebarHeader` subcomponent to encapsulate thumbnail, home navigation (`/story`), and story metadata. The component accepts `thumbnailSrc`, `title`, `accentColor` (for fallback badge), and handles missing thumbnail gracefully with an illustrated placeholder.
- Replace inline SVG icons with Heroicons (`@heroicons/react/24/outline`) to standardise styling and reduce maintenance overhead.

### Data Loading
- Extend `StorySummaryViewModel` and `StoryDetailViewModel` to include:
  - `thumbnailImagePath: string | null` resolved from the earliest shot that has a populated `keyFrameImagePath`.
  - `logline: string | null` extracted from constitution Markdown (first bullet or paragraph under the "Logline" heading).
- Update `getStoryList` to join against `shotsRepository.getShotsByStory` lazily; compute thumbnail using helper that respects storage prefixes (`generated/` vs `/generated/`).
- Update `getStory` to reuse the thumbnail helper and expose logline so both the sidebar header and the story list share consistent copy.
- Adjust server mappers to keep existing return shape backwards compatible (additive fields only) and to guard against missing Supabase credentials by falling back to `null` thumbnail/logline without throwing.

### Constitution Rendering
- Replace bespoke Markdown parser with `react-markdown` plus `remark-gfm` to support headings, emphasis, lists, blockquotes, inline code, and tables.
- Map rendered elements to Tailwind typography classes to maintain alignment with the new palette (e.g. headings use `text-text-primary`, lists use custom markers matching accent tones).
- Ensure external links render with underline+accent color and open in new tabs with `rel="noopener"` for security.

### Visual Tab
- Replace existing `visual_reference_package` dependency with direct consumption of `visualDesignDocument`:
  - Character cards show the `character_model_sheet_image_path` (transformed through `transformImagePath`) above metadata blocks (role, description, attire, physique, facial features).
  - Environment cards display `environment_reference_image_path` plus structured details (overall description, lighting, color tones, key elements) and associated scenelets chips.
- Build TypeScript guards that coerce raw `unknown` payloads into strongly typed structures, returning `null` if required fields are missing so the UI can render contextual empty states.
- When an image path is missing, show a neutral placeholder illustration with helper text prompting the generation workflow.

### Audio Tab
- Parse the `audioDesignDocument` into a typed view model that exposes `sonic_identity`, `narrator_voice_profile`, `character_voice_profiles`, and `music_and_ambience_cues` while preserving the raw JSON for reference.
- Render stacked sections:
  1. Sonic identity card summarising tone, pacing, and instrumentation notes using badges and callouts that match the new palette.
  2. Narrator + character voice profiles rendered as a table or grid with character avatars/initials, voice names, style descriptors, and intended usage notes.
  3. Cue playlist presenting each `music_and_ambience_cues` entry as a card with cue name, associated scenelets, and play/pause button tied to an `<audio>` element pointing at `public/generated/<story-id>/music/<cue_name>.m4a`.
- Implement a playback controller hook that ensures only one cue plays at a time; when a new cue starts, all other audio elements pause and reset to timestamp 0.
- Provide inline status feedback (e.g. `Now playing`) and disable unavailable cues when the media file is missing, surfacing a tooltip that references the BGM workflow requirement.
- Keep the raw audio design JSON collapsible at the bottom of the page for power users and debugging.

### Copywriting & Accessibility
- Update sidebar tab descriptions to speak to user outcomes:
  - Constitution: "Story blueprint & principles"
  - Script: "Branching script overview"
  - Storyboard: "Explore branching flow"
  - Visual: "Character & world art"
  - Audio: "Music & sound plan"
- Home button uses `HomeIcon` with `aria-label="Back to story list"`.
- Thumbnails include `alt` text summarising story title; placeholders describe absence (e.g. "No storyboard image yet").
- Ensure color contrast meets WCAG AA by pairing pastel backgrounds with darker typography tokens (`--color-text-primary` updated accordingly).

## Key Decisions

### Palette Implementation via CSS Variables
Using CSS variables keeps the palette swappable without rebuilding Tailwind. We continue to rely on Tailwind tokens that reference the variables, ensuring zero runtime theme switching but easy future overrides. No dynamic theming is required, so omitting CSS-in-JS keeps bundle size lean.

### Thumbnail Source of Truth
Using the first available key frame shot leverages existing generated assets without adding new storage. Alternative approaches (e.g. storing a dedicated thumbnail field) would require backend changes and are out of scope. The helper returns null when no shot images exist, allowing cards to render placeholders gracefully.

### Markdown Rendering Library Choice
`react-markdown` with `remark-gfm` delivers standard Markdown features while keeping dependencies lightweight and tree-shakeable. Rolling a custom parser would continue the existing shortcomings and increase maintenance surface area.

### Icon Library
Heroicons aligns with our Tailwind/Next stack, offers outline variants appropriate for sidebar navigation, and avoids licensing friction. Icons are imported per component to keep bundle size minimal.

### Defensive Visual Document Parsing
The visual design document is stored as JSON and may contain legacy fields. Dedicated type guards and transformation helpers prevent runtime crashes if the document hasn't been regenerated yet, and they make unit testing straightforward.

### Exclusive Audio Playback Management
Relying on a shared playback controller simplifies user experience compared to embedding independent `<audio>` tags without coordination. The controller will track the currently playing cue, pause any active audio when another cue starts, and expose callbacks for UI state. This avoids layering background tracks and keeps implementation within React state rather than adding a heavier audio library.
