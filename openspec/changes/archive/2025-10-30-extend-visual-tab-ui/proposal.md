# Proposal: Extend Visual Tab UI

## Overview

The Visuals tab currently displays only the raw JSON of the visual design document. This proposal extends the Visuals tab to provide a comprehensive, user-friendly interface for viewing visual design artifacts including:
- Character reference images with detailed metadata
- Environment keyframe images with detailed metadata
- Global aesthetic design (visual style and color palette)
- Visual reference package JSON
- Visual design document JSON (existing)

## Problem Statement

The current Visuals tab (at `apps/story-tree-ui/src/app/story/[storyId]/visual/page.tsx`) only renders:
- The visual design document as a JSON code block

This limited view makes it difficult for users to:
- Browse character reference images and their generation prompts
- Browse environment keyframe images and their generation prompts
- Understand the visual style and color palette at a glance
- Navigate between design metadata and reference imagery

## Goals

1. **Rich Image Display**: Present character and environment reference images in an organized, browsable grid layout with card-based UI
2. **Detailed Metadata Panels**: Show comprehensive metadata for selected images in a right-side detail panel (similar to storyboard shot panel)
3. **Design Document Integration**: Display character and environment design details from the visual design document beneath their respective image grids
4. **Global Aesthetic Presentation**: Render the visual style and master color palette in a clean, scannable format
5. **Preserve Existing Data**: Keep the current visual design document JSON display for reference

## Scope

### In Scope
- Extend `/story/[storyId]/visual` page to display visual reference package data
- Create reusable UI components for:
  - Character reference image cards and grids
  - Environment keyframe image cards and grids
  - Image detail panel (right-side overlay)
  - Global aesthetic display (visual style + color palette)
- Fetch and integrate `visualReferencePackage` from story record
- Handle missing/partial data gracefully (empty states)
- Ensure responsive layout with proper spacing

### Out of Scope
- Editing or modifying visual design or reference data
- Image upload or regeneration
- Visual design workflow triggers from UI
- Mobile-optimized layouts (desktop-first approach)
- Image zoom/lightbox functionality beyond detail panel

## Constraints

- Must use existing UI patterns from storyboard components (e.g., `ShotDetailPanel` structure)
- Must integrate with existing `getStory` data fetching in `apps/story-tree-ui/src/server/data/stories.ts`
- Must handle cases where `visualReferencePackage` is null or incomplete
- Must preserve existing theme tokens and TailwindCSS styling patterns
- Should maintain generous spacing without wasting space (as per requirement doc)

## Success Criteria

1. Users can browse character reference images in a grid layout
2. Users can click an image to see full metadata in a right-side detail panel
3. Users can see character design details (from visual design doc) below the character's image grid
4. Users can browse environment keyframe images in a similar grid layout
5. Users can see environment design details below environment image grids
6. Users can view global aesthetic (visual style + color palette) in a scannable format
7. The visual design document JSON is preserved and accessible
8. The visual reference package JSON is displayed for reference
9. All text content properly renders newlines (`\n`) and formatting
10. Empty states are shown when data is missing

## Open Questions

1. Should character and environment sections be collapsible/expandable for long stories with many characters?
2. Should the image detail panel support keyboard navigation (arrow keys to move between images)?
3. How should we handle very long image_generation_prompt strings in the detail panel (scrollable vs. truncated)?
4. Should the global aesthetic section appear at the top or bottom of the page?

## Related Work

- This change builds upon the existing visual design and visual reference specifications
- Uses the same data model as defined in `visual-design` and `visual-reference` specs
- Follows UI patterns established in the storyboard tab implementation
- Integrates with the existing story UI shell and navigation
