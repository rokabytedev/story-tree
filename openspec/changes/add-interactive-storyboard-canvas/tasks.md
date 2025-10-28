# Tasks: Add Interactive Storyboard Canvas

## Overview
This document outlines the ordered implementation tasks for building the interactive storyboard canvas visualization. Tasks are organized into logical batches that deliver incremental user-visible progress.

---

## Batch 1: Dependencies and Data Layer (Foundation)

### Task 1.1: Install ReactFlow and d3-hierarchy dependencies
**Description**: Add required npm packages for canvas and layout

**Steps**:
1. Run `npm install @xyflow/react@^12.9.0 d3-hierarchy@^3.1.2` in `apps/story-tree-ui`
2. Run `npm install -D @types/d3-hierarchy@^3.1.0`
3. Verify installations in `package.json` and `package-lock.json`

**Validation**:
- `package.json` includes `@xyflow/react`, `d3-hierarchy` in dependencies
- TypeScript types for d3-hierarchy are available (no import errors)

**Dependencies**: None

---

### Task 1.2: Create TypeScript types for storyboard data
**Description**: Define interfaces for story tree data structures

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/types.ts`
2. Define `StoryTreeData` interface with scenelets and branchingPoints arrays
3. Define `SceneletNodeData` and `BranchingPointNodeData` interfaces
4. Export all types

**Validation**:
- TypeScript compiles without errors
- Types match design document specifications

**Dependencies**: None

---

### Task 1.3: Implement getStoryTreeData server function
**Description**: Add server-side function to fetch and transform story tree data

**Steps**:
1. Open `apps/story-tree-ui/src/server/data/stories.ts`
2. Add `getStoryTreeData(storyId: string)` function
3. Call existing `assembleStoryTreeSnapshot` to get YAML data
4. Parse and transform snapshot entries into `StoryTreeData` format
5. Handle error cases (no data, parsing failures)
6. Export function

**Validation**:
- Function returns structured data for existing stories
- Function returns null for non-existent stories
- Error handling works (test with invalid data)
- TypeScript types are correct

**Dependencies**: Task 1.2

---

### Task 1.4: Write unit tests for data transformation
**Description**: Test data fetching and transformation logic

**Steps**:
1. Create `apps/story-tree-ui/src/server/data/stories.test.ts`
2. Write test: "returns null for non-existent story"
3. Write test: "transforms scenelets correctly"
4. Write test: "transforms branching points correctly"
5. Write test: "handles empty story tree"
6. Run tests with `npm test`

**Validation**:
- All tests pass
- Code coverage includes error cases

**Dependencies**: Task 1.3

---

## Batch 2: Basic Canvas Rendering (First Visual)

### Task 2.1: Create StoryboardCanvas skeleton component
**Description**: Set up basic ReactFlow canvas component structure

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/StoryboardCanvas.tsx`
2. Add `'use client'` directive
3. Import ReactFlow and required styles: `import '@xyflow/react/dist/style.css'`
4. Create component accepting `data: StoryTreeData` prop
5. Render empty ReactFlow component with basic config (fitView, zoom limits)
6. Export component

**Validation**:
- Component renders without errors
- Canvas displays in browser (even if empty)
- Zoom/pan controls work on empty canvas

**Dependencies**: Task 1.1, Task 1.2

---

### Task 2.2: Update storyboard page to use canvas
**Description**: Replace empty state with new canvas component

**Steps**:
1. Open `apps/story-tree-ui/src/app/story/[storyId]/storyboard/page.tsx`
2. Import `getStoryTreeData` function
3. Call `getStoryTreeData(storyId)` in server component
4. Conditionally render `<StoryboardCanvas data={...} />` if data exists
5. Keep empty state for when data is null
6. Handle loading and error states

**Validation**:
- Page renders canvas when story has data
- Page shows empty state when story has no scenelets
- No runtime errors in browser console

**Dependencies**: Task 1.3, Task 2.1

---

### Task 2.3: Implement tree layout calculation utility
**Description**: Create utility functions for d3-hierarchy layout

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/layoutUtils.ts`
2. Implement `buildHierarchy(data: StoryTreeData)` to create hierarchical structure
3. Implement `calculateTreeLayout(hierarchy)` using d3-hierarchy `tree()`
4. Set node size to [320 + 96, 200 + 80] for spacing
5. Return laid-out tree with (x, y) coordinates
6. Export functions

**Validation**:
- Layout calculation produces valid coordinates
- No node overlaps in output
- Parent nodes are positioned above children

**Dependencies**: Task 1.1, Task 1.2

---

### Task 2.4: Write unit tests for layout utilities
**Description**: Test tree layout calculation logic

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/layoutUtils.test.ts`
2. Write test: "buildHierarchy creates correct tree structure"
3. Write test: "calculateTreeLayout assigns x,y coordinates"
4. Write test: "layout handles single node tree"
5. Write test: "layout handles linear tree (no branching)"
6. Write test: "layout handles binary tree with multiple branches"
7. Run tests

**Validation**:
- All tests pass
- Edge cases covered (single node, linear, branching)

**Dependencies**: Task 2.3

---

### Task 2.5: Implement data-to-ReactFlow transformation
**Description**: Map layout data to ReactFlow nodes and edges

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/dataTransformers.ts`
2. Implement `mapToReactFlowNodes(layoutTree, data)` function
3. Create nodes with type 'scenelet' for scenelets, 'branchingPoint' for branching points
4. Set node positions from layout coordinates
5. Implement `mapToReactFlowEdges(layoutTree, data)` function
6. Create edges connecting parent to child nodes
7. Export functions

**Validation**:
- Functions return valid ReactFlow node and edge arrays
- Node IDs match data IDs
- Edge source/target IDs reference existing nodes

**Dependencies**: Task 2.3

---

### Task 2.6: Integrate layout into canvas component
**Description**: Connect layout logic to canvas rendering

**Steps**:
1. Open `StoryboardCanvas.tsx`
2. Import layout and transformer functions
3. Calculate layout in component using `useMemo`
4. Map to ReactFlow nodes and edges
5. Pass nodes and edges to `<ReactFlow>` component
6. Test with real story data

**Validation**:
- Canvas displays placeholder nodes at correct positions
- Edges connect nodes correctly
- Tree structure is visually accurate

**Dependencies**: Task 2.5

---

## Batch 3: Custom Node Components (Content Display)

### Task 3.1: Create SceneletNode component
**Description**: Build custom card node for scenelets

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/SceneletNode.tsx`
2. Accept `NodeProps` from ReactFlow
3. Render card layout with:
   - Top handle (target)
   - Scenelet ID and description
   - Shot carousel (placeholder divs)
   - Dialogue lines
   - Bottom handle (source)
4. Apply Tailwind styles matching mock design
5. Export component

**Validation**:
- Component renders with sample data
- Card layout matches mock (320px width, rounded corners, shadow)
- Handles are positioned correctly

**Dependencies**: Task 1.2

---

### Task 3.2: Create BranchingPointNode component
**Description**: Build custom node for branching decisions

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/BranchingPointNode.tsx`
2. Accept `NodeProps` from ReactFlow
3. Render node with:
   - Top handle (target)
   - "Choice" label with primary color
   - Choice prompt text
   - List of choice labels with arrows
   - Bottom handle (source)
4. Apply distinct styling (primary accent, thicker border)
5. Export component

**Validation**:
- Component renders with sample data
- Styling clearly differentiates from scenelet nodes
- Choice information is readable

**Dependencies**: Task 1.2

---

### Task 3.3: Register custom node types in canvas
**Description**: Configure ReactFlow to use custom node components

**Steps**:
1. Open `StoryboardCanvas.tsx`
2. Import `SceneletNode` and `BranchingPointNode`
3. Create `nodeTypes` object mapping 'scenelet' and 'branchingPoint' to components
4. Pass `nodeTypes` prop to `<ReactFlow>`
5. Update node data in transformer to include all required fields

**Validation**:
- Custom nodes render instead of default nodes
- Scenelet content (description, dialogue) is visible
- Branching point choices are displayed

**Dependencies**: Task 3.1, Task 3.2, Task 2.6

---

### Task 3.4: Style nodes to match theme
**Description**: Apply consistent theming to custom nodes

**Steps**:
1. Update `SceneletNode.tsx` to use theme tokens:
   - `bg-surface`, `border-border`, `text-text`, `text-text-muted`
2. Update `BranchingPointNode.tsx` to use theme tokens:
   - `bg-primary/10`, `border-primary`, `text-primary`
3. Test in both light and dark modes (if supported)
4. Ensure text contrast meets accessibility standards

**Validation**:
- Nodes use consistent theme colors
- Nodes adapt to theme changes
- Text is readable against backgrounds

**Dependencies**: Task 3.3

---

## Batch 4: Interactions and Polish (User Experience)

### Task 4.1: Configure zoom and pan controls
**Description**: Fine-tune canvas interaction settings

**Steps**:
1. Open `StoryboardCanvas.tsx`
2. Set `minZoom={0.1}` and `maxZoom={2}` on ReactFlow
3. Enable `fitView` on initial render
4. Add zoom/pan controls: `<Controls />` from ReactFlow (optional)
5. Test zoom with mouse wheel and trackpad
6. Test pan by dragging background

**Validation**:
- Zoom works smoothly (0.1x to 2x range)
- Pan works by dragging canvas background
- Initial view fits entire tree in viewport

**Dependencies**: Task 3.3

---

### Task 4.2: Add edge styling
**Description**: Customize edge appearance for better visibility

**Steps**:
1. Open `StoryboardCanvas.tsx` or create `edgeStyles.ts`
2. Configure default edge style:
   - Edge type: `default` or `smoothstep`
   - Stroke color: theme border color
   - Stroke width: 2px
   - Animated: false (unless desired)
3. Pass edge options to ReactFlow
4. Test edge rendering with various tree structures

**Validation**:
- Edges are visible and connect nodes correctly
- Edge style complements theme
- Edges don't obscure node content

**Dependencies**: Task 3.3

---

### Task 4.3: Improve canvas height and layout
**Description**: Ensure canvas uses appropriate viewport height

**Steps**:
1. Open `StoryboardCanvas.tsx`
2. Set canvas container height: `className="h-[calc(100vh-200px)]"` (adjust as needed)
3. Ensure canvas fills available space without overflowing
4. Test on different screen sizes (responsive behavior)

**Validation**:
- Canvas height is appropriate for viewport
- No vertical scrolling of canvas container
- Responsive on smaller screens

**Dependencies**: Task 2.2

---

### Task 4.4: Add loading state for data fetching
**Description**: Show loading indicator while fetching story data

**Steps**:
1. Open storyboard page component
2. Add Suspense boundary around canvas (if using Next.js streaming)
3. Create simple loading component (spinner or skeleton)
4. Show loading state while data is being fetched
5. Test with slow network (throttle in DevTools)

**Validation**:
- Loading indicator displays during fetch
- Canvas renders after data loads
- No layout shift when transitioning from loading to loaded

**Dependencies**: Task 2.2

---

### Task 4.5: Handle error states gracefully
**Description**: Display user-friendly errors when data fetch fails

**Steps**:
1. Update `getStoryTreeData` to throw errors for failures
2. Add error boundary or try-catch in page component
3. Create error state component with retry option
4. Test error scenarios (database down, invalid data)

**Validation**:
- Error message is user-friendly and actionable
- User can retry or navigate away
- No uncaught exceptions in console

**Dependencies**: Task 1.3

---

## Batch 5: Testing and Optimization (Quality Assurance)

### Task 5.1: Write integration tests for canvas rendering
**Description**: Test complete storyboard rendering flow

**Steps**:
1. Create `apps/story-tree-ui/src/components/storyboard/StoryboardCanvas.test.tsx`
2. Write test: "renders canvas with sample tree data"
3. Write test: "displays correct number of nodes"
4. Write test: "displays correct number of edges"
5. Write test: "scenelet nodes show content"
6. Write test: "branching point nodes show choices"
7. Use React Testing Library or Playwright for tests

**Validation**:
- All integration tests pass
- Tests cover key rendering scenarios

**Dependencies**: Task 3.3

---

### Task 5.2: Performance test with large trees
**Description**: Verify performance with 50-100 node trees

**Steps**:
1. Create test story with 50 scenelets
2. Create test story with 100 scenelets
3. Measure render time (React DevTools Profiler)
4. Measure layout calculation time (console.time)
5. Test FPS during zoom/pan (Chrome DevTools Performance)
6. Document results

**Validation**:
- 50-node tree renders in < 1 second
- 100-node tree renders in < 2 seconds
- Zoom/pan maintains ~60 FPS

**Dependencies**: Task 4.1

---

### Task 5.3: Optimize bundle size with code splitting
**Description**: Lazy load storyboard components to reduce initial bundle

**Steps**:
1. Update storyboard page to lazy load `StoryboardCanvas`
2. Use Next.js `dynamic()` import with `ssr: false`
3. Measure bundle size impact with `npm run build` and `@next/bundle-analyzer`
4. Document bundle size before/after

**Validation**:
- Storyboard code is in separate chunk
- Initial page load bundle is smaller
- Canvas loads quickly when tab is accessed

**Dependencies**: Task 3.3

---

### Task 5.4: Manual QA testing across scenarios
**Description**: Comprehensive manual testing of storyboard features

**Test Cases**:
1. Single-node tree (root only)
2. Linear tree (no branching, 10 nodes)
3. Binary tree with 2 branching points
4. Complex tree with mixed linear and branching paths
5. Empty story (no scenelets)
6. Error scenario (database unavailable)

**Validation**:
- All scenarios render correctly
- No visual bugs or layout issues
- Interactions work smoothly

**Dependencies**: Task 4.5

---

### Task 5.5: Accessibility audit
**Description**: Ensure storyboard meets accessibility standards

**Steps**:
1. Test keyboard navigation (Tab, Shift+Tab)
2. Test with screen reader (VoiceOver, NVDA)
3. Check color contrast with WCAG checker
4. Add ARIA labels to nodes (if missing)
5. Document accessibility findings and improvements

**Validation**:
- Canvas is keyboard navigable
- Nodes have accessible names
- Color contrast meets WCAG AA

**Dependencies**: Task 3.4

---

## Batch 6: Documentation and Handoff (Completion)

### Task 6.1: Update component documentation
**Description**: Document usage and API for storyboard components

**Steps**:
1. Add JSDoc comments to `StoryboardCanvas.tsx`
2. Document props for `SceneletNode` and `BranchingPointNode`
3. Add usage examples in comments
4. Update README (if applicable)

**Validation**:
- JSDoc is complete and accurate
- TypeScript IntelliSense shows helpful hints

**Dependencies**: Task 5.4

---

### Task 6.2: Create visual regression tests (optional)
**Description**: Set up screenshot comparison tests for UI consistency

**Steps**:
1. Use Playwright or Percy for visual testing
2. Capture screenshots of key scenarios
3. Store baseline images
4. Configure CI to run visual tests

**Validation**:
- Visual tests pass with baseline
- Changes trigger visual diff alerts

**Dependencies**: Task 5.4

**Note**: This task is optional and may be deferred if not in critical path

---

## Task Summary

**Total Tasks**: 25
**Batches**: 6

**Estimated Effort**:
- Batch 1 (Foundation): 4-6 hours
- Batch 2 (Basic Canvas): 6-8 hours
- Batch 3 (Custom Nodes): 4-6 hours
- Batch 4 (Interactions): 3-4 hours
- Batch 5 (Testing/Optimization): 4-6 hours
- Batch 6 (Documentation): 2-3 hours

**Total**: 23-33 hours (3-5 days for single developer)

**Parallelization Opportunities**:
- Tasks 1.2 and 1.3 can be done in parallel (different files)
- Tasks 3.1 and 3.2 can be done in parallel (different components)
- Tasks 5.1, 5.2, 5.3 can be done in parallel (different testing approaches)

**Critical Path**:
1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3 → 2.5 → 2.6 → 3.1/3.2 → 3.3 → 4.1 → 5.4

**User-Visible Milestones**:
- After Batch 1: Data layer ready (no UI yet)
- After Batch 2: Basic tree visualization visible
- After Batch 3: Full content displayed in nodes
- After Batch 4: Polished, interactive experience
- After Batch 5: Production-ready quality
- After Batch 6: Documented and maintainable
