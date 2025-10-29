# Proposal: Add Interactive Storyboard Canvas

## Change ID
`add-interactive-storyboard-canvas`

## Context
The Story Tree UI currently displays a placeholder empty state for the Storyboard tab. Users need an interactive visual diagram to browse and understand the story tree structure (binary tree where each node can have 1 or 2 child nodes). The storyboard should render scenelets as card-style nodes connected by edges, with support for viewing shots and dialogue, and distinguishing branching points from linear progression.

## Problem Statement
Users cannot visualize the narrative flow of their interactive story. The current empty state provides no insight into:
- The overall structure of the story tree
- The relationship between scenelets (parent-child connections)
- Where branching points occur (user choices)
- The content of each scenelet (description, dialogue, shots)

This makes it difficult to understand, review, and navigate complex branching narratives.

## Proposed Solution
Implement an interactive canvas-based storyboard visualization using ReactFlow (@xyflow/react) with d3-hierarchy for tree layout. The storyboard will:

1. **Fetch story tree data**: Load scenelets from the existing `getStoryTreeScript` API (which returns the story tree snapshot YAML)
2. **Render tree structure**: Display scenelets as custom card nodes with:
   - Scenelet ID and description
   - Horizontal scrollable carousel of shots (placeholder images initially)
   - Dialogue lines (character: line format)
3. **Show branching points**: Display branching decision nodes with distinct styling showing:
   - The choice prompt question from the parent scenelet
   - The choice labels from child scenelets
4. **Enable interactions**: Provide zoom, pan, and drag capabilities for navigating large trees
5. **Support responsive layout**: Use d3-hierarchy tree layout algorithm to automatically position nodes

## Capabilities Affected
- **story-ui**: New requirement for interactive storyboard canvas visualization

## Success Criteria
1. Users can see the full story tree structure from root to terminal nodes
2. Users can zoom in/out and pan around the canvas to navigate large trees
3. Users can read scenelet content (description, dialogue) directly in the diagram
4. Users can identify branching points and understand the choices available
5. The visualization correctly handles trees with 50-100 nodes with acceptable performance
6. The storyboard integrates seamlessly with existing UI shell (sidebar navigation, theme)

## Dependencies
- ReactFlow (@xyflow/react v12) for canvas and node rendering
- d3-hierarchy for tree layout calculations
- Existing story tree data API (getStoryTreeScript)
- Existing UI theme and components (Tailwind CSS, shadcn/ui patterns)

## Out of Scope
- Image generation for shots (will use placeholders)
- Real-time collaboration or editing of the tree
- Animation/video playback of scenelets
- Export to image/PDF functionality
- Drag-and-drop reordering of nodes (noted as lower priority in plan)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Large bundle size from ReactFlow (~874 kB) | High | Use code splitting and lazy load the storyboard tab |
| Complex tree layout calculations | Medium | Use proven d3-hierarchy algorithms, test with realistic data |
| Performance degradation with large trees | Medium | Test with trees of 100+ nodes, implement virtualization if needed |
| YAML parsing complexity | Low | Use existing `assembleStoryTreeSnapshot` logic, already tested |

## Alternatives Considered
1. **react-d3-tree**: Simpler tree-specific library, but SVG-based custom nodes are more complex than ReactFlow's component-based approach for rendering cards with images
2. **Raw D3.js**: Maximum flexibility but requires significant development effort and manual React integration
3. **Cytoscape.js**: Powerful graph library but overkill for binary trees, larger bundle size, steeper learning curve

ReactFlow was selected for its React-native approach (custom nodes as components), excellent TypeScript support, built-in interactions (zoom/pan), active maintenance, and strong community.

## Related Changes
None - this is a net-new capability

## Open Questions
1. Should we persist user's zoom/pan position in browser storage?
2. Should we support keyboard navigation (arrow keys) between nodes?
3. Should we add a minimap for easier navigation of large trees?
4. What is the maximum expected tree size (number of nodes)?

These questions can be addressed during implementation and refined based on user feedback.
