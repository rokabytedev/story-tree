# Tasks: Enhance Storyboard with Shot Images

## Milestone 1: Backend Data Layer

### Task 1.1: Extend shots repository to include image paths in query results
- [x] Verify `getShotsByStory` returns `keyFrameImagePath` and `firstFrameImagePath` fields
- [x] Add tests verifying image path fields are mapped correctly (null and string values)
- [x] Update TypeScript types in repository to include image path fields

### Task 1.2: Add scenelet-specific shot query method to repository
- [x] Implement `getShotsByScenelets(storyId, sceneletIds)` method
- [x] Return shots grouped by scenelet_id as a map structure
- [x] Handle edge cases: empty input, blank ids, missing shots
- [x] Add unit tests covering happy path and edge cases

### Task 1.3: Integrate shots data into story tree data fetching
- [x] Modify `getStoryTreeData` in `apps/story-tree-ui/src/server/data/stories.ts`
- [x] Fetch shots using shots repository after fetching scenelets
- [x] Map shots to their corresponding scenelets in the returned data structure
- [x] Ensure shots are ordered by shot_index ascending within each scenelet

### Task 1.4: Transform image paths for public URL access
- [x] Create helper function to transform DB paths to public URLs (prepend `/generated/`)
- [x] Apply transformation in `mapStoryTreeEntriesToStoryboardData` when mapping shot data
- [x] Handle null image paths gracefully (return null, don't transform)
- [x] Add unit tests verifying path transformation logic

---

## Milestone 2: Type Definitions and Data Modeling

### Task 2.1: Define shot image types for UI components
- [x] Create `ShotImage` interface in `apps/story-tree-ui/src/components/storyboard/types.ts`
- [x] Include fields: shotIndex, keyFrameImagePath, firstFrameImagePath, storyboardPayload, prompts, createdAt
- [x] Ensure type matches repository output format
- [x] Document that image path fields contain public URLs (e.g. `/generated/{story-id}/...`)

### Task 2.2: Extend StoryboardScenelet type with shots array
- [x] Add `shots: ShotImage[]` property to `StoryboardScenelet` interface
- [x] Keep existing `shotSuggestions: string[]` for backward compatibility
- [x] Update `mapStoryTreeEntriesToStoryboardData` to include shots in scenelet transformation
- [x] Add data transformer tests verifying shots are mapped correctly

---

## Milestone 3: Shot Image Carousel Component

### Task 3.1: Create ShotCarousel component
- [x] Create `apps/story-tree-ui/src/components/storyboard/ShotCarousel.tsx`
- [x] Accept props: `shots: ShotImage[]`, `onShotClick: (shot: ShotImage) => void`
- [x] Implement horizontal scroll container with CSS scroll-snap
- [x] Use 16:9 aspect ratio for all images with fixed height (160px)
- [x] Add lazy loading for offscreen images (`loading="lazy"`)
- [x] Show placeholder for missing/failed images with error message

### Task 3.2: Add carousel navigation controls
- [x] Implement left and right arrow button overlays
- [x] Use `scrollBy()` for smooth scrolling to next/previous shot
- [x] Show/hide arrows based on scroll position (hide left at start, hide right at end)
- [x] Ensure buttons are keyboard accessible (tab + enter)
- [x] Add visual hover states for arrows

### Task 3.3: Integrate ShotCarousel into SceneletNode
- [x] Import and use ShotCarousel in SceneletNode component
- [x] Replace existing shot suggestions section when shots data exists
- [x] Pass `onShotClick` handler from SceneletNode props
- [x] Update section label from "Shot Suggestions" to "Shots"
- [x] Remove shot description text rendering

---

## Milestone 4: Shot Detail Panel Component

### Task 4.1: Create ShotDetailPanel component
- [x] Create `apps/story-tree-ui/src/components/storyboard/ShotDetailPanel.tsx`
- [x] Accept props: `shot: ShotImage | null`, `onClose: () => void`
- [x] Implement slide-in panel from right side with 480px width (full width on mobile)
- [x] Add semi-transparent backdrop overlay
- [x] Implement close button in top-right corner
- [x] Add keyboard support (Escape to close)
- [x] Add click-backdrop-to-close behavior

### Task 4.2: Implement panel content layout
- [x] Display large key frame image at top (maintain 16:9 aspect ratio)
- [x] Show shot metadata: shot index, created timestamp
- [x] Display prompts in labeled sections (first frame, key frame, video clip)
- [x] Render storyboard_payload as formatted JSON with syntax highlighting
- [x] Ensure JSON code block wraps long lines (use `white-space: pre-wrap`)
- [x] Handle missing image with placeholder

### Task 4.3: Add slide-in/out animations
- [x] Implement 300ms slide animation using CSS transitions
- [x] Coordinate panel and backdrop fade timing
- [x] Ensure smooth animation performance (use transform instead of position)
- [x] Test animation on various screen sizes

---

## Milestone 5: Page-Level Integration

### Task 5.1: Add shot detail panel state management to storyboard page
- [x] Modify `apps/story-tree-ui/src/app/story/[storyId]/storyboard/page.tsx` to be client component
- [x] Add `selectedShot` state using `useState<ShotImage | null>(null)`
- [x] Create `handleShotClick` and `handleClosePanel` callbacks
- [x] Pass `onShotClick` handler to StoryboardCanvas component

### Task 5.2: Wire shot click handler through component tree
- [x] Update `StoryboardCanvas` props to accept `onShotClick` handler
- [x] Pass handler to scenelet nodes via ReactFlow node data
- [x] Update `SceneletNode` to accept and use `onShotClick` from node data
- [x] Verify click events propagate correctly from carousel to panel

### Task 5.3: Render ShotDetailPanel in storyboard page
- [x] Add ShotDetailPanel component to page layout
- [x] Conditionally render when `selectedShot` is not null
- [x] Position panel above canvas using z-index
- [x] Verify panel closes properly on all close triggers (button, backdrop, Escape)

### Task 5.4: Remove storyboard header container
- [x] Delete header section with "Storyboard Canvas" title and description
- [x] Adjust canvas height calculation to use full available viewport
- [x] Update spacing and padding for clean edge-to-edge canvas
- [x] Verify responsive behavior on mobile and desktop

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
