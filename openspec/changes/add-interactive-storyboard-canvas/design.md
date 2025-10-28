# Design: Add Interactive Storyboard Canvas

## Architecture Overview

The interactive storyboard canvas will be implemented as a client-side React component within the existing Next.js Story Tree UI application. The architecture follows a three-layer approach:

```
┌─────────────────────────────────────────────────────────┐
│  Storyboard Page (Next.js Route)                        │
│  - Fetches story tree data server-side                  │
│  - Passes data to client component                      │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  StoryboardCanvas Component (Client Component)          │
│  - Transforms data to ReactFlow format                  │
│  - Calculates tree layout with d3-hierarchy             │
│  - Manages canvas state (zoom, pan, selection)          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Custom Node Components                                 │
│  - SceneletNode: Card with description, shots, dialogue │
│  - BranchingPointNode: Choice prompt and labels         │
└─────────────────────────────────────────────────────────┘
```

## Component Structure

### 1. Storyboard Page (`apps/story-tree-ui/src/app/story/[storyId]/storyboard/page.tsx`)

**Responsibility**: Server-side data fetching and hydration

```typescript
// Server Component
export default async function StoryboardTab({ params }) {
  const { storyId } = await params;

  // Fetch story tree data server-side
  const storyTreeData = await getStoryTreeData(storyId);

  if (!storyTreeData) {
    return <EmptyState ... />;
  }

  // Pass data to client component
  return <StoryboardCanvas data={storyTreeData} />;
}
```

**Key Decisions**:
- Use existing `getStoryTreeScript` function to fetch YAML data
- Parse YAML to extract scenelets and branching points
- Pass structured data (not raw YAML) to client component
- Handle error states (no data, parsing failures)

### 2. Data Layer (`apps/story-tree-ui/src/server/data/stories.ts`)

**New Function**: `getStoryTreeData(storyId: string)`

```typescript
export interface StoryTreeData {
  scenelets: Array<{
    id: string;
    parentId: string | null;
    description: string;
    dialogue: Array<{ character: string; line: string }>;
    shotSuggestions: string[];
    choiceLabel?: string | null;
  }>;
  branchingPoints: Array<{
    id: string;
    sourceSceneletId: string;
    choicePrompt: string;
    choices: Array<{ label: string; leadsTo: string }>;
  }>;
}
```

**Key Decisions**:
- Reuse existing `assembleStoryTreeSnapshot` from agent-backend
- Transform story tree snapshot entries into flat arrays
- Keep data structure close to existing `SceneletDigest` and `BranchingPointDigest` types
- Return structured TypeScript types, not raw YAML

### 3. StoryboardCanvas Component (`apps/story-tree-ui/src/components/storyboard/StoryboardCanvas.tsx`)

**Responsibility**: Transform data to ReactFlow format, calculate layout, render canvas

```typescript
'use client';

import { ReactFlow, Node, Edge } from '@xyflow/react';
import { hierarchy, tree } from 'd3-hierarchy';
import { SceneletNode } from './SceneletNode';
import { BranchingPointNode } from './BranchingPointNode';

const nodeTypes = {
  scenelet: SceneletNode,
  branchingPoint: BranchingPointNode,
};

export function StoryboardCanvas({ data }: { data: StoryTreeData }) {
  // 1. Transform data to hierarchical structure
  const rootNode = buildHierarchy(data);

  // 2. Calculate tree layout with d3-hierarchy
  const layout = tree<TreeNode>()
    .nodeSize([NODE_WIDTH + H_SPACING, NODE_HEIGHT + V_SPACING]);
  const treeLayout = layout(hierarchy(rootNode));

  // 3. Map to ReactFlow nodes and edges
  const nodes: Node[] = mapToReactFlowNodes(treeLayout, data);
  const edges: Edge[] = mapToReactFlowEdges(treeLayout, data);

  return (
    <div className="h-[calc(100vh-200px)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      />
    </div>
  );
}
```

**Key Decisions**:
- Use `'use client'` directive since ReactFlow requires browser APIs
- Calculate layout on client (tree structure may change frequently)
- Use d3-hierarchy `tree()` layout for binary trees (not `cluster()` or `tidy-tree`)
- Node sizing: 320px width (matches mock card), variable height
- Spacing: 96px horizontal, 80px vertical between nodes
- Enable `fitView` to auto-zoom to show entire tree on load
- Set reasonable zoom limits (0.1x to 2x)

### 4. Custom Node Components

#### SceneletNode (`apps/story-tree-ui/src/components/storyboard/SceneletNode.tsx`)

```typescript
import { Handle, Position, NodeProps } from '@xyflow/react';

export function SceneletNode({ data }: NodeProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 w-80 shadow-md">
      {/* Top handle for incoming edges */}
      <Handle type="target" position={Position.Top} />

      {/* Scenelet ID and description */}
      <div className="mb-3">
        <p className="font-semibold text-base">{data.id}</p>
        <p className="text-xs text-text-muted">{data.description}</p>
      </div>

      {/* Shots carousel */}
      <div className="mb-3 overflow-x-auto flex gap-2">
        {data.shotSuggestions.map((shot, i) => (
          <div key={i} className="shrink-0 w-full aspect-video bg-muted rounded-md" />
        ))}
      </div>

      {/* Dialogue */}
      <div className="border-t border-border pt-3 space-y-2 text-sm">
        {data.dialogue.map((line, i) => (
          <p key={i} className="text-text-muted">
            <span className="font-medium text-text">{line.character}:</span> {line.line}
          </p>
        ))}
      </div>

      {/* Bottom handle for outgoing edges */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

**Key Decisions**:
- Fixed width (320px / w-80) to match mock design
- Handles positioned at top (target) and bottom (source) for vertical tree layout
- Shot carousel uses full-width placeholder divs (aspect-video for 16:9)
- Dialogue lines truncated if too long (future: expand on hover)
- Use existing Tailwind theme tokens (surface, border, text, text-muted)

#### BranchingPointNode (`apps/story-tree-ui/src/components/storyboard/BranchingPointNode.tsx`)

```typescript
export function BranchingPointNode({ data }: NodeProps) {
  return (
    <div className="bg-primary/10 border-2 border-primary rounded-lg p-4 w-80">
      <Handle type="target" position={Position.Top} />

      {/* Choice prompt */}
      <div className="mb-2">
        <p className="text-sm font-semibold text-primary">Choice</p>
        <p className="text-xs text-text">{data.choicePrompt}</p>
      </div>

      {/* Choice labels */}
      <div className="space-y-1">
        {data.choices.map((choice, i) => (
          <div key={i} className="text-xs bg-surface rounded px-2 py-1">
            → {choice.label}
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

**Key Decisions**:
- Distinct styling (primary color accent, thicker border) to indicate branching
- Display choice prompt and all available choice labels
- Smaller, more compact design since branching nodes are connectors, not content
- Same width as scenelet nodes for visual consistency

### 5. Tree Layout Algorithm

**Algorithm Choice**: d3-hierarchy `tree()` layout

**Rationale**:
- Designed for parent-child hierarchies (perfect for story trees)
- Handles variable-width trees (binary trees with 1 or 2 children)
- Produces tidy layouts with no overlapping nodes
- Well-tested, performant algorithm

**Layout Parameters**:
```typescript
const layout = tree<TreeNode>()
  .nodeSize([320 + 96, 200 + 80])  // [width + h-spacing, height + v-spacing]
  .separation((a, b) => a.parent === b.parent ? 1 : 1.5);  // Tighter for siblings
```

**Alternative Considered**: `cluster()` layout
- Rejected because it forces all leaf nodes to the same depth
- Story trees have variable depths (different path lengths)
- `tree()` allows natural depth variation

### 6. Data Transformation Flow

```
Story Tree Snapshot (YAML)
  ↓ [assembleStoryTreeSnapshot]
StoryTreeSnapshot { entries: [...] }
  ↓ [getStoryTreeData]
StoryTreeData { scenelets: [...], branchingPoints: [...] }
  ↓ [buildHierarchy]
Hierarchical Tree { id, children: [...] }
  ↓ [d3-hierarchy tree() layout]
Laid-out Tree with (x, y) coordinates
  ↓ [mapToReactFlowNodes]
ReactFlow Node[] { id, type, position, data }
  ↓ [mapToReactFlowEdges]
ReactFlow Edge[] { id, source, target }
  ↓ [ReactFlow render]
Interactive Canvas with Custom Node Components
```

## Technical Decisions

### 1. Library Selection: ReactFlow

**Decision**: Use ReactFlow (@xyflow/react) v12 for canvas rendering

**Rationale**:
- React-native: Custom nodes are React components (easy to build card UIs)
- TypeScript-first: Excellent type safety and IntelliSense
- Built-in interactions: Zoom, pan, drag work out-of-box
- Active maintenance: v12 released 2025, 1.7M weekly downloads
- Strong community: 33k GitHub stars, extensive documentation
- Proven at scale: Used in production by many applications

**Trade-off**: Larger bundle size (~874 kB), mitigated by:
- Code splitting: Lazy load storyboard tab
- Tree shaking: Import only needed ReactFlow modules
- Acceptable given productivity gains and feature richness

### 2. Layout Algorithm: d3-hierarchy

**Decision**: Use d3-hierarchy `tree()` for layout calculations

**Rationale**:
- Industry standard for hierarchical layouts
- Small bundle size (~20 kB for d3-hierarchy module)
- Pure functions (no side effects, easy to test)
- Mature, well-documented algorithm

**Trade-off**: Requires learning d3-hierarchy API, but:
- API is simple for basic use cases
- Many examples available online
- ReactFlow docs show integration patterns

### 3. Data Fetching: Server-Side

**Decision**: Fetch story tree data server-side in Next.js page component

**Rationale**:
- Faster initial render (no client-side loading spinner)
- SEO-friendly (though less critical for authenticated app)
- Follows Next.js 14+ best practices (server components)
- Reduces client-side complexity

**Trade-off**: Cannot use React hooks in page component, but:
- Can still pass data to client components
- Client component handles interactivity (zoom, pan)

### 4. Node Sizing: Fixed Width, Variable Height

**Decision**: Scenelet nodes have fixed width (320px), height adapts to content

**Rationale**:
- Fixed width ensures consistent tree structure
- Variable height accommodates different dialogue lengths
- Matches mock design (320px card width)

**Trade-off**: Need to measure node height for accurate edge routing
- Solution: ReactFlow handles this automatically with node dimensions

### 5. Shot Placeholders: Static Colored Divs

**Decision**: Use static placeholder divs for shots (no images initially)

**Rationale**:
- Scope constraint: Image generation not in initial implementation
- Faster development and testing
- Reduces bundle size and API dependencies

**Future**: Replace placeholders with actual shot images when available

### 6. Edge Styling: Simple Straight Lines

**Decision**: Use default ReactFlow edges (Bezier curves)

**Rationale**:
- Cleaner visual appearance than straight lines
- ReactFlow optimizes edge routing automatically
- Matches typical flowchart aesthetics

**Customization**: Can switch to straight or step edges if preferred

### 7. Performance Strategy

**For 50-100 nodes**:
- No virtualization needed (ReactFlow handles this efficiently)
- Memoize node/edge computations with `useMemo`
- Avoid re-calculating layout on every render

**For 100+ nodes (future)**:
- Enable ReactFlow's viewport rendering optimization
- Consider pagination or "expand/collapse" subtrees
- Add search/filter to focus on specific paths

### 8. State Management: Local Component State

**Decision**: Use React hooks (useState, useMemo) for canvas state

**Rationale**:
- Simple, straightforward for isolated component
- No need for global state management (Zustand, Redux)
- ReactFlow provides `useReactFlow` hook for canvas interactions

**Future**: If adding multi-panel views or shared state, consider Zustand

## File Structure

```
apps/story-tree-ui/src/
├── app/story/[storyId]/storyboard/
│   └── page.tsx                          # Server component (data fetching)
├── components/storyboard/
│   ├── StoryboardCanvas.tsx              # Client component (ReactFlow)
│   ├── SceneletNode.tsx                  # Custom node for scenelets
│   ├── BranchingPointNode.tsx            # Custom node for branching points
│   ├── layoutUtils.ts                    # d3-hierarchy layout logic
│   ├── dataTransformers.ts               # Data mapping functions
│   └── types.ts                          # TypeScript types
└── server/data/
    └── stories.ts                         # Add getStoryTreeData function
```

## Dependencies to Add

```json
{
  "dependencies": {
    "@xyflow/react": "^12.9.0",
    "d3-hierarchy": "^3.1.2"
  },
  "devDependencies": {
    "@types/d3-hierarchy": "^3.1.0"
  }
}
```

## Testing Strategy

### Unit Tests
- `layoutUtils.test.ts`: Test d3-hierarchy layout calculations
- `dataTransformers.test.ts`: Test data mapping functions
- `getStoryTreeData.test.ts`: Test server-side data fetching

### Integration Tests
- Render storyboard with sample tree data
- Verify correct number of nodes and edges
- Test zoom/pan interactions (via ReactFlow Testing Library)

### Visual/Manual Tests
- Load trees of varying sizes (1, 10, 50, 100 nodes)
- Verify layout correctness (no overlaps, proper spacing)
- Test on different screen sizes (responsive behavior)
- Check performance (FPS, render time)

## Accessibility Considerations

1. **Keyboard Navigation**:
   - ReactFlow supports Tab navigation between nodes
   - Consider adding arrow key navigation for tree traversal

2. **Screen Readers**:
   - Add ARIA labels to nodes (e.g., "Scenelet 1: Description")
   - Provide text alternative: "Tree structure" announcement

3. **Color Contrast**:
   - Ensure branching point primary color meets WCAG AA standards
   - Test with existing theme (light/dark mode support)

4. **Zoom Controls**:
   - Add accessible zoom in/out buttons (in addition to scroll zoom)
   - Consider zoom percentage indicator

## Open Questions & Future Enhancements

### Open Questions (to clarify during implementation)
1. **Persistence**: Should we save user's zoom/pan position in localStorage?
   - **Recommendation**: Yes, for better UX on revisits

2. **Keyboard Nav**: Support arrow keys for node-to-node navigation?
   - **Recommendation**: Nice-to-have, not MVP

3. **Minimap**: Add ReactFlow MiniMap component for large trees?
   - **Recommendation**: Add if user testing shows navigation difficulties

4. **Max Tree Size**: What's the practical limit for node count?
   - **Recommendation**: Test with 100-200 nodes, optimize if needed

### Future Enhancements (out of scope for this change)
- Real shot images (requires image generation integration)
- Node editing (inline editing of dialogue, descriptions)
- Drag-and-drop reordering (low priority per plan doc)
- Export to PNG/SVG (for sharing)
- Animation: Highlight path when user selects a choice
- Collaborative mode: Multi-user real-time editing
- Version history: Time-travel through story tree versions

## Migration Path

**No migration needed** - this is a new feature with no existing data to migrate.

**Backward Compatibility**: The existing empty state will be replaced, but no breaking changes to:
- API contracts
- Database schema
- Other UI components

## Rollout Plan

1. **Phase 1**: Implement core visualization (nodes, edges, layout)
2. **Phase 2**: Add interactions (zoom, pan, node selection)
3. **Phase 3**: Polish (styling, animations, accessibility)
4. **Phase 4**: Performance optimization (if needed based on testing)
5. **Phase 5**: User feedback and iteration

**Feature Flag**: Not required - storyboard tab is already isolated

**Rollback**: If critical issues arise, revert to empty state placeholder
