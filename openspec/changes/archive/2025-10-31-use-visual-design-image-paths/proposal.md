# Proposal: Use Visual Design Image Paths for Shot Generation

## Change ID
`use-visual-design-image-paths`

## Overview
Switch shot image generation from using visual reference package to directly reading character model sheet and environment reference image paths stored in the visual design document (`character_designs[*].character_model_sheet_image_path` and `environment_designs[*].environment_reference_image_path`).

## Motivation

### Current State
Shot image generation currently:
1. Loads the entire `visual_reference_package` from the story
2. Uses the reference image recommender with `referencedDesigns` (character and environment IDs)
3. Constructs file paths using hardcoded patterns (`character-model-sheet-1.png`, `keyframe_1.png`)
4. Validates file existence and loads images for Gemini reference

This approach has a dependency on the visual reference package, which was an intermediate artifact in the workflow.

### Desired State
Shot image generation should:
1. Load the `visual_design_document` (which is already loaded by the shot production phase)
2. Read the pre-generated image paths directly from `character_designs[*].character_model_sheet_image_path` and `environment_designs[*].environment_reference_image_path`
3. Load only the images that exist (paths are set by the character model sheet and environment reference tasks)
4. No longer depend on `visual_reference_package` at all

### Benefits
1. **Single source of truth**: Visual design document becomes the canonical location for all generated visual assets, including image paths
2. **Simpler data flow**: Shot generation depends only on visual design document, not multiple artifacts
3. **Consistent patterns**: Character and environment reference images are already stored in visual design document following the same pattern
4. **Cleaner architecture**: Removes dependency on visual reference package for shot generation workflow

### Migration Path
The visual reference package will be deprecated in a future change. This proposal leaves existing code in place to enable a clean deprecation later.

## Impact Analysis

### Components Affected
- `shot-image/shotImageTask.ts` - Primary implementation changes
- `shot-image/referenceImageLoader.ts` - May need updates to load from visual design paths
- `reference-images/referenceImageRecommender.ts` - Add support for visual design document as source

### Backward Compatibility
- Existing visual reference package code remains functional
- No breaking changes to public APIs or database schema
- Shot image task continues to work with existing stories

### Testing Strategy
- Update existing shot image tests to verify new path loading
- Add tests for missing image paths (graceful degradation)
- Integration tests to verify end-to-end shot generation with new path source

## Success Criteria
1. Shot image generation successfully reads character model sheet paths from `character_designs[*].character_model_sheet_image_path`
2. Shot image generation successfully reads environment reference paths from `environment_designs[*].environment_reference_image_path`
3. All existing tests pass with minimal modifications
4. Shot generation continues to work when image paths are missing (graceful degradation)
5. No dependency on `visual_reference_package` in shot image generation code path
