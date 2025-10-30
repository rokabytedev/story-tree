# Tasks: Enhance Storyboard with Shot Images

## Milestone 1: Backend Data Layer

### Task 1.1: Extend shots repository to include image paths in query results
- [ ] Verify `getShotsByStory` returns `keyFrameImagePath` and `firstFrameImagePath` fields
- [ ] Add tests verifying image path fields are mapped correctly (null and string values)
- [ ] Update TypeScript types in repository to include image path fields

### Task 1.2: Add scenelet-specific shot query method to repository
- [ ] Implement `getShotsByScenelets(storyId, sceneletIds)` method
- [ ] Return shots grouped by scenelet_id as a map structure
- [ ] Handle edge cases: empty input, blank ids, missing shots
- [ ] Add unit tests covering happy path and edge cases

### Task 1.3: Integrate shots data into story tree data fetching
- [ ] Modify `getStoryTreeData` in `apps/story-tree-ui/src/server/data/stories.ts`
- [ ] Fetch shots using shots repository after fetching scenelets
- [ ] Map shots to their corresponding scenelets in the returned data structure
- [ ] Ensure shots are ordered by shot_index ascending within each scenelet

### Task 1.4: Transform image paths for public URL access
- [ ] Create helper function to transform DB paths to public URLs (prepend `/generated/`)
- [ ] Apply transformation in `mapStoryTreeEntriesToStoryboardData` when mapping shot data
- [ ] Handle null image paths gracefully (return null, don't transform)
- [ ] Add unit tests verifying path transformation logic

---

## Milestone 2: Type Definitions and Data Modeling

### Task 2.1: Define shot image types for UI components
- [ ] Create `ShotImage` interface in `apps/story-tree-ui/src/components/storyboard/types.ts`
- [ ] Include fields: shotIndex, keyFrameImagePath, firstFrameImagePath, storyboardPayload, prompts, createdAt
- [ ] Ensure type matches repository output format
- [ ] Document that image path fields contain public URLs (e.g. `/generated/{story-id}/...`)

### Task 2.2: Extend StoryboardScenelet type with shots array
- [ ] Add `shots: ShotImage[]` property to `StoryboardScenelet` interface
- [ ] Keep existing `shotSuggestions: string[]` for backward compatibility
- [ ] Update `mapStoryTreeEntriesToStoryboardData` to include shots in scenelet transformation
- [ ] Add data transformer tests verifying shots are mapped correctly

---

## Milestone 3: Shot Image Carousel Component

### Task 3.1: Create ShotCarousel component
- [ ] Create `apps/story-tree-ui/src/components/storyboard/ShotCarousel.tsx`
- [ ] Accept props: `shots: ShotImage[]`, `onShotClick: (shot: ShotImage) => void`
- [ ] Implement horizontal scroll container with CSS scroll-snap
- [ ] Use 16:9 aspect ratio for all images with fixed height (160px)
- [ ] Add lazy loading for offscreen images (`loading="lazy"`)
- [ ] Show placeholder for missing/failed images with error message

### Task 3.2: Add carousel navigation controls
- [ ] Implement left and right arrow button overlays
- [ ] Use `scrollBy()` for smooth scrolling to next/previous shot
- [ ] Show/hide arrows based on scroll position (hide left at start, hide right at end)
- [ ] Ensure buttons are keyboard accessible (tab + enter)
- [ ] Add visual hover states for arrows

### Task 3.3: Integrate ShotCarousel into SceneletNode
- [ ] Import and use ShotCarousel in SceneletNode component
- [ ] Replace existing shot suggestions section when shots data exists
- [ ] Pass `onShotClick` handler from SceneletNode props
- [ ] Update section label from "Shot Suggestions" to "Shots"
- [ ] Remove shot description text rendering

---

## Milestone 4: Shot Detail Panel Component

### Task 4.1: Create ShotDetailPanel component
- [ ] Create `apps/story-tree-ui/src/components/storyboard/ShotDetailPanel.tsx`
- [ ] Accept props: `shot: ShotImage | null`, `onClose: () => void`
- [ ] Implement slide-in panel from right side with 480px width (full width on mobile)
- [ ] Add semi-transparent backdrop overlay
- [ ] Implement close button in top-right corner
- [ ] Add keyboard support (Escape to close)
- [ ] Add click-backdrop-to-close behavior

### Task 4.2: Implement panel content layout
- [ ] Display large key frame image at top (maintain 16:9 aspect ratio)
- [ ] Show shot metadata: shot index, created timestamp
- [ ] Display prompts in labeled sections (first frame, key frame, video clip)
- [ ] Render storyboard_payload as formatted JSON with syntax highlighting
- [ ] Ensure JSON code block wraps long lines (use `white-space: pre-wrap`)
- [ ] Handle missing image with placeholder

### Task 4.3: Add slide-in/out animations
- [ ] Implement 300ms slide animation using CSS transitions
- [ ] Coordinate panel and backdrop fade timing
- [ ] Ensure smooth animation performance (use transform instead of position)
- [ ] Test animation on various screen sizes

---

## Milestone 5: Page-Level Integration

### Task 5.1: Add shot detail panel state management to storyboard page
- [ ] Modify `apps/story-tree-ui/src/app/story/[storyId]/storyboard/page.tsx` to be client component
- [ ] Add `selectedShot` state using `useState<ShotImage | null>(null)`
- [ ] Create `handleShotClick` and `handleClosePanel` callbacks
- [ ] Pass `onShotClick` handler to StoryboardCanvas component

### Task 5.2: Wire shot click handler through component tree
- [ ] Update `StoryboardCanvas` props to accept `onShotClick` handler
- [ ] Pass handler to scenelet nodes via ReactFlow node data
- [ ] Update `SceneletNode` to accept and use `onShotClick` from node data
- [ ] Verify click events propagate correctly from carousel to panel

### Task 5.3: Render ShotDetailPanel in storyboard page
- [ ] Add ShotDetailPanel component to page layout
- [ ] Conditionally render when `selectedShot` is not null
- [ ] Position panel above canvas using z-index
- [ ] Verify panel closes properly on all close triggers (button, backdrop, Escape)

### Task 5.4: Remove storyboard header container
- [ ] Delete header section with "Storyboard Canvas" title and description
- [ ] Adjust canvas height calculation to use full available viewport
- [ ] Update spacing and padding for clean edge-to-edge canvas
- [ ] Verify responsive behavior on mobile and desktop

---

OPTIONAL DO NOT IMPLEMENT BELOW:

## Milestone 6: Error Handling and Edge Cases

### Task 6.1: Handle missing shot data gracefully
- [ ] Test storyboard rendering when scenelets have no shots
- [ ] Ensure scenelet nodes render normally without carousel section
- [ ] Verify backward compatibility with stories that predate shot images

### Task 6.2: Handle image loading failures
- [ ] Implement `onError` handler for shot images
- [ ] Show fallback placeholder with clear error message
- [ ] Test with invalid image paths and network failures
- [ ] Verify panel handles missing images without breaking

### Task 6.3: Handle malformed storyboard payload
- [ ] Wrap JSON.stringify in try/catch for storyboard_payload rendering
- [ ] Display error message when payload can't be parsed/formatted
- [ ] Log errors for debugging without breaking UI

---

## Milestone 7: Polish and Accessibility

### Task 7.1: Add loading states for images
- [ ] Show subtle loading spinner/skeleton for images being loaded
- [ ] Use low-quality placeholder blur (if image service supports LQIP)
- [ ] Ensure smooth transition from loading to loaded state

### Task 7.2: Ensure keyboard accessibility
- [ ] Verify carousel navigation arrows are keyboard accessible
- [ ] Ensure shot images can receive focus and be clicked via Enter/Space
- [ ] Test panel close with Escape key across browsers
- [ ] Verify screen reader announcements for interactive elements

### Task 7.3: Responsive design polish
- [ ] Test carousel and panel on mobile, tablet, and desktop viewports
- [ ] Ensure touch gestures work for carousel scrolling on mobile
- [ ] Verify panel goes full-width on mobile screens
- [ ] Test panel slide animation performance on mobile devices
