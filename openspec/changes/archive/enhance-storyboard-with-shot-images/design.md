# Design: Enhance Storyboard with Shot Images

## Context

The storyboard canvas currently renders scenelet cards with:
- Shot suggestion text descriptions in a horizontal scrollable carousel
- Placeholder boxes with 16:9 aspect ratio
- No ability to see actual shot images or detailed shot metadata

Meanwhile, the backend has:
- `public.shots` table with `key_frame_image_path` and `first_frame_image_path` columns
- Complete shot metadata including storyboard payloads and generation prompts
- Shots repository for querying shot data by story

This design bridges that gap.

## Architectural Decisions

### 1. Data Fetching Strategy

**Decision:** Fetch shots data alongside scenelets in the server-side `getStoryTreeData` function.

**Rationale:**
- Minimizes client-server roundtrips (single data fetch for entire page)
- Leverages existing server-side data fetching pattern
- Keeps component logic simple (no loading states for shots)
- Shots are small metadata records; fetching all at once is acceptable for medium-sized stories

**Alternative Considered:** Lazy-load shots on carousel scroll
- Rejected: Adds complexity with loading states and error handling in multiple places
- Not needed: Shot metadata is lightweight, network cost is low

### 2. Image Loading Strategy

**Decision:** Load images on-demand from Next.js public directory, relying on browser caching.

**Rationale:**
- Key frame images may be large (hundreds of KB each)
- Loading all images upfront would slow initial render
- Browser cache will handle subsequent views efficiently
- Standard `<img>` tags with proper loading attributes (`loading="lazy"`) provide good UX

**Implementation Notes:**
- Use `loading="lazy"` for offscreen images
- Use `loading="eager"` for first visible image in each carousel
- Add proper fallback for missing images (show placeholder with error message)

### 3. Image Path Transformation

**Decision:** Transform database-relative paths to public URL paths by prepending `/generated/`.

**Context:**
- Database stores relative paths starting with story ID, e.g.:
  ```
  999c2177-c02b-41e1-bb4d-ec9dff2bb403/shots/scenelet-1/shot-1_key_frame.png
  ```
- Physical files are in Next.js public directory:
  ```
  apps/story-tree-ui/public/generated/999c2177.../shot-1_key_frame.png
  ```
- Browser needs public URL path:
  ```
  /generated/999c2177-c02b-41e1-bb4d-ec9dff2bb403/shots/scenelet-1/shot-1_key_frame.png
  ```

**Rationale:**
- Database stores storage-agnostic relative paths (portable across environments)
- UI layer transforms to environment-specific URLs (currently local public folder)
- Clear separation of concerns: storage layer doesn't know about serving strategy
- Future-proof: Can later switch to CDN/S3 URLs by changing transformation logic only

**Implementation:**
```typescript
function transformImagePath(dbPath: string | null): string | null {
  if (!dbPath) return null;
  return `/generated/${dbPath}`;
}
```

**Location:** Apply transformation in `mapStoryTreeEntriesToStoryboardData` when mapping shot data from repository to UI types.

### 4. Shot Detail Panel Architecture

**Decision:** Implement as a React client component with local state, rendered conditionally at the storyboard page level.

**Rationale:**
- Needs interactivity (open/close, navigate between shots)
- Should overlay the entire storyboard canvas (not scoped to a single node)
- Avoids prop drilling by using context or lifting state to page level

**Component Structure:**
```
StoryboardPage
├── StoryboardCanvas (existing)
│   └── SceneletNode (modified)
│       └── ShotCarousel (new)
└── ShotDetailPanel (new)
```

**State Management:**
- Use React `useState` at page level for `selectedShot` (null when closed)
- Pass `onShotClick` handler down to `ShotCarousel`
- Panel renders when `selectedShot` is not null

**Alternative Considered:** Use URL query params for selected shot
- Rejected: Adds unnecessary complexity; this is ephemeral UI state, not shareable state
- Future work: Could be added later if users want shareable shot links

### 5. Canvas Layout Changes

**Decision:** Remove the header card container by modifying the storyboard page layout, not the canvas component.

**Rationale:**
- Canvas component should remain focused on rendering the tree
- Page layout is the appropriate place for page-level structure decisions
- Maintains clear separation of concerns

**Implementation:**
- Remove the `<header>` block from `apps/story-tree-ui/src/app/story/[storyId]/storyboard/page.tsx`
- Adjust canvas height calculation to use full available viewport height

### 6. Shot Data Type Modeling

**Decision:** Extend `StoryboardScenelet` type to include `shots: ShotImage[]` array.

**Type Structure:**
```typescript
interface ShotImage {
  shotIndex: number;
  keyFrameImagePath: string | null;
  firstFrameImagePath: string | null;
  storyboardPayload: unknown;
  firstFramePrompt: string;
  keyFramePrompt: string;
  videoClipPrompt: string;
  createdAt: string;
}

interface StoryboardScenelet {
  // ... existing fields
  shots: ShotImage[];  // NEW
  shotSuggestions: string[];  // DEPRECATED but kept for backward compatibility
}
```

**Rationale:**
- Keeps all scenelet-related data together in a single structure
- Maintains backward compatibility with existing `shotSuggestions` field
- Provides all necessary data for both carousel and detail panel

### 7. Carousel Navigation Behavior

**Decision:** Use CSS scroll-snap for smooth horizontal scrolling with arrow button controls.

**Rationale:**
- Native browser scrolling provides good performance and accessibility
- Scroll-snap gives polished "card snapping" behavior without JavaScript
- Arrow buttons provide explicit navigation for users who prefer clicking over scrolling
- Works well with keyboard navigation (tab to button, enter to navigate)

**Implementation Notes:**
- Use `scroll-snap-type: x mandatory` on carousel container
- Use `scroll-snap-align: start` on each image card
- Arrow buttons use `scrollBy()` to move one card width
- Show/hide arrows based on scroll position (hide left at start, hide right at end)

## UI/UX Considerations

### Shot Carousel Design
- Fixed height for all images (e.g., 160px) to maintain 16:9 aspect ratio
- Remove shot description text (was showing placeholder text anyway)
- Show shot number badge (e.g., "Shot 1") on hover for context
- Highlight currently visible shot with subtle border or shadow

### Shot Detail Panel Design
- Slide in from right side of screen
- Semi-transparent backdrop to maintain canvas context
- Panel width: 480px on desktop, full width on mobile
- Close button in top-right corner
- Smooth slide-in/out animation (300ms)

### Panel Content Layout
```
┌─────────────────────────────────┐
│ [X Close]                        │
│                                  │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │   Key Frame Image (16:9)    │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                  │
│ Shot Details                     │
│ ├ Shot Index: 1                  │
│ ├ Created: Oct 30, 2025          │
│                                  │
│ Prompts                          │
│ ├ First Frame: ...               │
│ ├ Key Frame: ...                 │
│ └ Video Clip: ...                │
│                                  │
│ Storyboard Payload               │
│ ┌─────────────────────────────┐ │
│ │ {                           │ │
│ │   "camera_angle": "medium", │ │
│ │   ...                       │ │
│ │ }                           │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## Performance Considerations

- **Initial Load:** Fetching shot metadata adds ~100-500ms to page load (acceptable)
- **Image Loading:** Lazy loading prevents blocking initial render
- **Memory:** Loaded images cached by browser; no custom cache needed
- **Rendering:** React Flow already handles large graphs efficiently; shot images don't add significant overhead

## Error Handling

- **Missing Images:** Show placeholder with "Image not available" message
- **Failed Image Load:** Use `<img onError>` to swap to placeholder
- **Missing Shot Data:** Fall back to showing `shotSuggestions` text (backward compatibility)
- **Malformed storyboard_payload:** Wrap JSON.stringify in try/catch, show error message in panel

## Testing Strategy

- **Unit Tests:** Test data transformation functions (shots repository mapping)
- **Component Tests:** Test carousel navigation and panel open/close
- **Integration Tests:** Test full data flow from DB to UI
- **Manual Testing:** Verify with stories that have shots and stories that don't

## Future Enhancements (Out of Scope)

- Video clip preview (if video generation is added)
- Side-by-side comparison of first frame vs key frame
- Edit shot metadata inline
- Download individual shot images
- Share specific shot via URL
