## Why

The storyboard UI currently displays placeholder boxes for shot suggestions with text descriptions. However, the system now generates actual key frame images for each shot (stored in `shots.key_frame_image_path`), which are not being utilized in the UI. This creates a disconnect between the rich visual content that exists in the backend and what users can see in the storyboard canvas.

Displaying actual shot images instead of placeholders would significantly improve the user experience by:
- Providing immediate visual feedback on shot composition and framing
- Enabling users to quickly assess the visual narrative flow
- Making the storyboard a true visual reference tool rather than just a text-based outline
- Allowing users to inspect detailed shot metadata including storyboard payloads

## What Changes

This change enhances the storyboard UI to display real shot key frame images in scenelet cards and adds interactive shot detail inspection:

- **Replace shot suggestion text with images**: Load actual key frame images from storage (16:9 aspect ratio) instead of showing placeholder boxes with text descriptions
- **Add image carousel navigation**: Implement left/right arrow controls to browse through multiple shots within each scenelet card
- **Add shot detail panel**: Create a slide-in panel that displays when users click a shot image, showing:
  - Larger key frame image
  - All shot metadata from the database (shot_index, prompts, created_at, etc.)
  - Formatted storyboard_payload JSON with proper line wrapping
- **Expand canvas viewport**: Remove the header card container to maximize canvas space
- **Fetch shot data from backend**: Extend data fetching to include shots for each scenelet from the `public.shots` table

## Impact

- **Affected specs:** story-ui, story-storage
- **Affected code:**
  - `apps/story-tree-ui/src/components/storyboard/SceneletNode.tsx` - replace text carousel with image carousel
  - `apps/story-tree-ui/src/components/storyboard/types.ts` - add shot image data types
  - `apps/story-tree-ui/src/app/story/[storyId]/storyboard/page.tsx` - remove header container
  - `apps/story-tree-ui/src/server/data/stories.ts` - fetch shots data
  - `supabase/src/shotsRepository.ts` - may need new query methods
  - New component: `apps/story-tree-ui/src/components/storyboard/ShotDetailPanel.tsx`
  - New component: `apps/story-tree-ui/src/components/storyboard/ShotCarousel.tsx`

## Scope

This change is tightly scoped to the storyboard visualization:
- Only affects the storyboard tab UI components and their data fetching
- Does not change shot generation logic or storage schema
- Does not affect other story artifact tabs (constitution, script, visual, audio)
- Assumes shot images already exist in storage for stories that have completed shot production
