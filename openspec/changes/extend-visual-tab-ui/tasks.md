# Tasks: Extend Visual Tab UI

## Milestone 1: Type Definitions and Data Fetching

- [ ] **Task 1.1**: Create `apps/story-tree-ui/src/components/visual/types.ts`
  - Define `VisualStyle`, `ColorPaletteEntry`, `GlobalAesthetic`
  - Define `CharacterDesign`, `EnvironmentDesign`, `VisualDesignDocument`
  - Define `CharacterReferencePlate`, `CharacterModelSheet`
  - Define `EnvironmentKeyframe`, `EnvironmentKeyframes`
  - Define `VisualReferencePackage`
  - Export all types

- [ ] **Task 1.2**: Update `StoryDetailViewModel` in `apps/story-tree-ui/src/server/data/stories.ts`
  - Add `visualReferencePackage: unknown | null` field to interface
  - Update `mapStoryRecordToDetail` to include `visualReferencePackage` from record
  - Verify existing `getStory` function returns the new field

- [ ] **Task 1.3**: Write unit tests for type parsing
  - Test parsing valid visual reference package JSON
  - Test parsing valid visual design document JSON
  - Test handling of null/undefined values
  - Test handling of malformed JSON

---

## Milestone 2: Reusable UI Components

- [ ] **Task 2.1**: Create `apps/story-tree-ui/src/components/visual/ReferenceImageCard.tsx`
  - Accept props: `imagePath`, `description`, `onClick`
  - Render image with 16:9 aspect ratio (or configurable)
  - Render description text below image with background separation
  - Handle missing image with placeholder
  - Make card clickable with hover state
  - Use theme-appropriate styling

- [ ] **Task 2.2**: Create `apps/story-tree-ui/src/components/visual/ImageDetailPanel.tsx`
  - Accept props: `selectedImage` (union of character/environment image types), `onClose`
  - Render fixed right-side overlay (similar to `ShotDetailPanel`)
  - Display full image at top
  - Display all metadata fields with proper labels
  - Properly render newlines in text content
  - Support ESC key to close
  - Support click outside to close
  - Support close button
  - Ensure accessibility (focus management, aria labels)

- [ ] **Task 2.3**: Create `apps/story-tree-ui/src/components/visual/GlobalAestheticSection.tsx`
  - Accept props: `globalAesthetic` (or null)
  - Render visual style name and description
  - Render color palette grid
  - Each color swatch shows: color block, name, hex code, usage notes
  - Handle missing global aesthetic gracefully

- [ ] **Task 2.4**: Write component tests for reusable components
  - Test `ReferenceImageCard` rendering and click handling
  - Test `ImageDetailPanel` open/close behavior
  - Test `GlobalAestheticSection` rendering color palette

---

## Milestone 3: Character and Environment Sections

- [ ] **Task 3.1**: Create `apps/story-tree-ui/src/components/visual/CharacterSection.tsx`
  - Accept props: `characterId`, `referencePlates`, `characterDesign`, `onImageClick`
  - Render character ID heading
  - Render grid of `ReferenceImageCard` components
  - Handle empty reference plates with message
  - Render character design details below grid
  - Display all fields from `detailed_description` (attire, physique, facial_features)
  - Format text properly (line breaks, labels)

- [ ] **Task 3.2**: Create `apps/story-tree-ui/src/components/visual/EnvironmentSection.tsx`
  - Accept props: `environmentId`, `keyframes`, `environmentDesign`, `onImageClick`
  - Render environment ID heading
  - Render grid of `ReferenceImageCard` components
  - Handle empty keyframes with message
  - Render environment design details below grid
  - Display all fields from `detailed_description` (overall_description, lighting_and_atmosphere, color_tones, key_elements)
  - Format text properly (line breaks, labels)

- [ ] **Task 3.3**: Write component tests for section components
  - Test `CharacterSection` rendering with images and design details
  - Test `EnvironmentSection` rendering with keyframes and design details
  - Test empty state handling for missing images

---

## Milestone 4: Main Visual Reference View Component

- [ ] **Task 4.1**: Create `apps/story-tree-ui/src/components/visual/VisualReferenceView.tsx`
  - Mark as client component ("use client")
  - Accept props: `visualReferencePackage`, `visualDesignDocument`
  - Implement state management for selected image
  - Parse and validate visual reference package structure
  - Match character IDs between visual design and reference
  - Match environment IDs between visual design and reference
  - Render characters section with all `CharacterSection` components
  - Render environments section with all `EnvironmentSection` components
  - Render `GlobalAestheticSection` component
  - Render visual reference package JSON (CodeBlock)
  - Render visual design document JSON (CodeBlock)
  - Render `ImageDetailPanel` overlay

- [ ] **Task 4.2**: Handle edge cases in `VisualReferenceView`
  - Handle missing visual reference package
  - Handle missing visual design document
  - Handle mismatched character/environment IDs
  - Handle parsing errors gracefully
  - Display appropriate error messages

- [ ] **Task 4.3**: Write integration tests for `VisualReferenceView`
  - Test full rendering with complete data
  - Test rendering with missing reference package
  - Test rendering with missing design document
  - Test image click opens detail panel
  - Test detail panel close behavior

---

## Milestone 5: Update Visual Tab Page

- [ ] **Task 5.1**: Update `apps/story-tree-ui/src/app/story/[storyId]/visual/page.tsx`
  - Import `VisualReferenceView` component
  - Fetch story using existing `getStory(storyId)`
  - Extract `visualReferencePackage` and `visualDesignDocument` from story
  - Conditionally render `VisualReferenceView` or empty state
  - Preserve existing error handling for database errors
  - Remove old JSON-only display (or keep as fallback)

OPTIONAL DO NOT IMPLEMENT:
- [ ] **Task 5.2**: Test visual tab page integration
  - Test page loads with complete visual data
  - Test page loads with missing visual reference package
  - Test page loads with missing visual design document
  - Test page handles database errors gracefully

---

## Milestone 6: Styling and Accessibility

- [ ] **Task 6.1**: Implement responsive grid layouts
  - Use CSS Grid or Flexbox for image card grids
  - Ensure cards have consistent sizing
  - Add appropriate gaps and spacing
  - Test layout on different screen sizes

- [ ] **Task 6.2**: Implement theme-consistent styling
  - Use existing TailwindCSS theme tokens
  - Match border, shadow, and background styles from storyboard components
  - Ensure proper text hierarchy (headings, body text, captions)
  - Test in light and dark mode

- [ ] **Task 6.3**: Accessibility audit
  - Add descriptive alt text to all images
  - Add aria labels to interactive elements
OPTIONAL DO NOT IMPLEMENT:
  - Test keyboard navigation (Tab, Shift+Tab, ESC)
  - Test focus management when opening/closing detail panel
  - Test with screen reader (VoiceOver or NVDA)

- [ ] **Task 6.4**: Handle long text content
  - Ensure long image prompts are scrollable in detail panel
  - Ensure long descriptions wrap properly in cards
OPTIONAL DO NOT IMPLEMENT:
  - Test with actual generated prompts from example data

---

OPTIONAL DO NOT IMPLEMENT:
## Milestone 7: Testing and Documentation

- [ ] **Task 7.1**: End-to-end testing
  - Test full workflow: navigate to visual tab → click image → view detail panel → close panel
  - Test with story that has multiple characters and environments
  - Test with story that has incomplete data
  - Test visual design JSON display
  - Test visual reference package JSON display

- [ ] **Task 7.2**: Visual regression testing
  - Capture screenshots of visual tab in different states
  - Compare against design mockups
  - Verify spacing and layout match requirements

- [ ] **Task 7.3**: Performance testing
  - Test page load time with large visual reference packages
  - Test rendering performance with 10+ characters/environments
  - Optimize image loading if necessary

- [ ] **Task 7.4**: Update documentation (if needed)
  - Document new components in component library
  - Add usage examples for visual reference view
  - Update any relevant README files

---

## Notes

- Each task should be completed and tested before moving to the next
- Tasks within a milestone can be worked on in parallel if dependencies allow
- All tests should pass before marking a milestone as complete
- Component tests should cover both happy path and error cases
- Integration tests should use realistic mock data from `docs/017_ui_visual_plan.md`
