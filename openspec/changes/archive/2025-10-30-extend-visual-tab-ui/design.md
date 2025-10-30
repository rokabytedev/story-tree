# Design: Extend Visual Tab UI

## Architectural Decisions

### 1. Component Structure

We will create new components following the existing storyboard pattern:

```
apps/story-tree-ui/src/components/visual/
├── VisualReferenceView.tsx         # Main container component
├── CharacterSection.tsx             # Character reference section
├── EnvironmentSection.tsx           # Environment keyframes section
├── GlobalAestheticSection.tsx       # Visual style + color palette
├── ReferenceImageCard.tsx           # Reusable image card component
├── ImageDetailPanel.tsx             # Right-side detail panel (similar to ShotDetailPanel)
└── types.ts                         # TypeScript types for visual reference data
```

### 2. Data Flow

```
visual/page.tsx (Server Component)
    ↓ fetch story data
    ↓ getStory(storyId) → StoryDetailViewModel
    ↓
VisualReferenceView (Client Component)
    ↓ receives visualReferencePackage + visualDesignDocument
    ↓
    ├── CharacterSection (for each character)
    │   ├── ReferenceImageCard[] (grid)
    │   └── CharacterDesignDetails (from visual design doc)
    │
    ├── EnvironmentSection (for each environment)
    │   ├── ReferenceImageCard[] (grid)
    │   └── EnvironmentDesignDetails (from visual design doc)
    │
    └── GlobalAestheticSection
        ├── VisualStyleDisplay
        └── ColorPaletteGrid

ImageDetailPanel (overlay, similar to ShotDetailPanel)
    ↓ shows selected image metadata
```

### 3. State Management

- **Client-side state**: Use `useState` for selected image (to drive the detail panel)
- **No global state**: All data flows down from server component as props
- **Keyboard events**: Use `useEffect` to handle ESC key for closing detail panel

### 4. Layout Strategy

Following the requirements document:

```
┌─────────────────────────────────────────────────────────────┐
│ VISUALS TAB HEADER                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CHARACTERS                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Character: cosmo                                      │  │
│  │ ┌────────┐ ┌────────┐ ┌────────┐                    │  │
│  │ │ Image  │ │ Image  │ │ Image  │  (grid of cards)   │  │
│  │ │  +     │ │  +     │ │  +     │                    │  │
│  │ │ desc   │ │ desc   │ │ desc   │                    │  │
│  │ └────────┘ └────────┘ └────────┘                    │  │
│  │                                                        │  │
│  │ Character Design Details (from visual design doc)     │  │
│  │ - Attire: ...                                         │  │
│  │ - Physique: ...                                       │  │
│  │ - Facial Features: ...                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ENVIRONMENTS                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Environment: cosmos-jungle-workshop                   │  │
│  │ ┌────────┐ ┌────────┐                                │  │
│  │ │ Image  │ │ Image  │  (grid of cards)               │  │
│  │ │  +     │ │  +     │                                │  │
│  │ │ desc   │ │ desc   │                                │  │
│  │ └────────┘ └────────┘                                │  │
│  │                                                        │  │
│  │ Environment Design Details (from visual design doc)   │  │
│  │ - Overall Description: ...                            │  │
│  │ - Lighting and Atmosphere: ...                        │  │
│  │ - Color Tones: ...                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  GLOBAL AESTHETIC                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Visual Style                                          │  │
│  │ Name: Vibrant Sci-Fi Storybook                        │  │
│  │ Description: ...                                      │  │
│  │                                                        │  │
│  │ Master Color Palette                                  │  │
│  │ ┌──────┐ ┌──────┐ ┌──────┐                          │  │
│  │ │ ████ │ │ ████ │ │ ████ │  (color swatch grid)     │  │
│  │ │ Name │ │ Name │ │ Name │                          │  │
│  │ │ Code │ │ Code │ │ Code │                          │  │
│  │ │ Usage│ │ Usage│ │ Usage│                          │  │
│  │ └──────┘ └──────┘ └──────┘                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  VISUAL REFERENCE PACKAGE JSON (CodeBlock)                 │
│  VISUAL DESIGN DOCUMENT JSON (CodeBlock)                   │
└─────────────────────────────────────────────────────────────┘
```

### 5. Type Definitions

Based on the example JSON structures in `docs/017_ui_visual_plan.md`:

```typescript
// apps/story-tree-ui/src/components/visual/types.ts

export interface VisualStyle {
  name: string;
  description: string;
}

export interface ColorPaletteEntry {
  hex_code: string;
  color_name: string;
  usage_notes: string;
}

export interface GlobalAesthetic {
  visual_style: VisualStyle;
  master_color_palette: ColorPaletteEntry[];
}

export interface CharacterDesign {
  role: string;
  character_id: string;
  detailed_description: {
    attire: string;
    physique: string;
    facial_features: string;
  };
}

export interface EnvironmentDesign {
  environment_id: string;
  detailed_description: {
    overall_description: string;
    lighting_and_atmosphere: string;
    color_tones: string;
    key_elements: string;
  };
  associated_scenelet_ids: string[];
}

export interface VisualDesignDocument {
  global_aesthetic: GlobalAesthetic;
  character_designs: CharacterDesign[];
  environment_designs: EnvironmentDesign[];
}

export interface CharacterReferencePlate {
  type: string;
  plate_description: string;
  image_generation_prompt: string;
  image_path?: string;
}

export interface CharacterModelSheet {
  character_id: string;
  reference_plates: CharacterReferencePlate[];
}

export interface EnvironmentKeyframe {
  keyframe_description: string;
  image_generation_prompt: string;
  image_path?: string;
}

export interface EnvironmentKeyframes {
  environment_id: string;
  keyframes: EnvironmentKeyframe[];
}

export interface VisualReferencePackage {
  character_model_sheets: CharacterModelSheet[];
  environment_keyframes: EnvironmentKeyframes[];
}
```

### 6. Component Responsibilities

#### `VisualReferenceView.tsx` (Client Component)
- Receives `visualReferencePackage` and `visualDesignDocument` as props
- Manages selected image state
- Renders character, environment, and global aesthetic sections
- Renders ImageDetailPanel overlay

#### `CharacterSection.tsx`
- Props: `character_id`, `reference_plates`, `character_design`
- Renders section header with character ID
- Renders grid of `ReferenceImageCard` components
- Renders character design details from visual design doc
- Handles click events to notify parent (for detail panel)

#### `EnvironmentSection.tsx`
- Props: `environment_id`, `keyframes`, `environment_design`
- Renders section header with environment ID
- Renders grid of `ReferenceImageCard` components
- Renders environment design details from visual design doc
- Handles click events to notify parent (for detail panel)

#### `ReferenceImageCard.tsx` (Reusable)
- Props: `imagePath`, `description`, `onClick`
- Displays image (or placeholder if missing)
- Displays description text below image
- Clickable to open detail panel

#### `ImageDetailPanel.tsx`
- Props: `selectedImage`, `onClose`
- Renders right-side overlay (similar to `ShotDetailPanel`)
- Shows full image at top
- Shows all metadata fields nicely formatted
- Properly renders newlines (`\n`) in text
- Supports ESC key to close

#### `GlobalAestheticSection.tsx`
- Props: `global_aesthetic`
- Renders visual style name and description
- Renders color palette as a grid of color swatches
- Each swatch shows: color block, name, hex code, usage notes

### 7. Error Handling and Empty States

**Missing visual reference package:**
```tsx
if (!story?.visualReferencePackage) {
  return (
    <EmptyState
      title="Visual reference unavailable"
      message="Visual reference images will populate once the workflow runs."
    />
  );
}
```

**Missing character images:**
- Show character section header and design details
- Show empty state message: "No reference images available for this character"

**Missing environment keyframes:**
- Show environment section header and design details
- Show empty state message: "No keyframes available for this environment"

**Image load failures:**
- Use `onError` handler to show placeholder with "Image not available"

### 8. Accessibility Considerations

- All images must have descriptive `alt` attributes
- Detail panel must support keyboard navigation (Tab, Shift+Tab, ESC)
- Color swatches must include text labels (not color-only information)
- Proper heading hierarchy (h2 for sections, h3 for subsections)
- Focus management when opening/closing detail panel

### 9. Performance Considerations

- Use Next.js Image component for optimized loading (if applicable)
- Lazy load images as they come into viewport (optional enhancement)
- Avoid re-rendering entire view when only detail panel state changes
- Use React.memo for card components if performance issues arise

### 10. Testing Strategy

- Unit tests for type parsing and data transformation
- Component tests for rendering different data states
- Integration test for full visual tab with mock data
- Visual regression tests for layout and styling
- Accessibility audit with axe-devtools

## Data Mapping

The visual tab page needs to:
1. Fetch story record using existing `getStory(storyId)`
2. Parse `visualReferencePackage` and `visualDesignDocument` fields
3. Match character IDs between visual design and visual reference
4. Match environment IDs between visual design and visual reference
5. Pass structured data to client components

**Update to `StoryDetailViewModel`:**
```typescript
export interface StoryDetailViewModel extends StorySummaryViewModel {
  constitutionMarkdown: string | null;
  visualDesignDocument: unknown | null;
  visualReferencePackage: unknown | null;  // ADD THIS
  audioDesignDocument: unknown | null;
}
```

**Mapping function in `stories.ts`:**
```typescript
function mapStoryRecordToDetail(record: StoryRecord): StoryDetailViewModel {
  return {
    // ... existing fields
    visualReferencePackage: record.visualReferencePackage ?? null,
  };
}
```

## Trade-offs

### Decision: Client Component vs Server Component for VisualReferenceView
**Chosen**: Client Component
**Rationale**: Requires interactive state for detail panel and image selection. Server component would require page navigation for each interaction.
**Trade-off**: Slightly larger client bundle, but better UX.

### Decision: Single Detail Panel vs Multiple Panels
**Chosen**: Single shared ImageDetailPanel
**Rationale**: Follows existing storyboard pattern, simpler state management.
**Trade-off**: Cannot compare multiple images side-by-side.

### Decision: Grid Layout vs Carousel for Images
**Chosen**: Grid layout
**Rationale**: Requirement doc specifies "grid-like layout". Better for browsing multiple images at once.
**Trade-off**: More vertical scrolling for characters/environments with many images.

### Decision: Color Palette Display
**Chosen**: Grid of color swatches with name, code, and usage
**Rationale**: Requirement doc says "show each color's name, code, usage in a grid kind layout".
**Trade-off**: Takes more space than a simple color bar, but provides essential context.

## Future Enhancements (Out of Scope)

- Image regeneration from UI
- Image editing or cropping
- Downloadable reference sheets
- Mobile-optimized layouts
- Image zoom/lightbox
- Keyboard navigation between images in detail panel
- Collapsible character/environment sections
- Search/filter for characters or environments
