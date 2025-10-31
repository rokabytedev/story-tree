# Design: Use Visual Design Image Paths for Shot Generation

## Architecture Overview

This change refactors the shot image generation system to read reference image paths directly from the visual design document instead of using the visual reference package.

## Current Architecture

```
Shot Image Task
  ↓
Loads visual_reference_package from story
  ↓
Reference Image Recommender
  ↓
Constructs paths using hardcoded patterns:
  - <story-id>/visuals/characters/<character-id>/character-model-sheet-1.png
  - <story-id>/visuals/environments/<environment-id>/keyframe_1.png
  ↓
Loads images from file system
  ↓
Sends to Gemini for shot generation
```

### Issues with Current Approach
1. **Dual dependency**: Requires both `visual_reference_package` and the actual image files
2. **Filename coupling**: Hardcodes filenames (`character-model-sheet-1.png`, `keyframe_1.png`) that must match generation tasks
3. **No single source of truth**: Image metadata split across multiple documents
4. **Redundant validation**: File existence checked at generation time rather than read time

## Proposed Architecture

```
Shot Image Task
  ↓
Loads visual_design_document from story
  ↓
Reference Image Loader (refactored)
  ↓
Reads paths from visual design document:
  - character_designs[*].character_model_sheet_image_path
  - environment_designs[*].environment_reference_image_path
  ↓
Loads images from file system (only if paths exist)
  ↓
Sends to Gemini for shot generation
```

### Benefits of Proposed Approach
1. **Single source of truth**: Visual design document contains all visual asset metadata
2. **Dynamic paths**: Uses actual saved paths rather than constructed patterns
3. **Graceful degradation**: Missing paths are handled naturally (no image = no reference)
4. **Decoupled from visual reference package**: No longer requires that artifact

## Data Flow

### Input
- `storyId`: Story identifier
- `referencedDesigns`: Object containing character and environment IDs needed for the shot
  ```typescript
  {
    characters: ["character-id-1", "character-id-2"],
    environments: ["environment-id-1"]
  }
  ```

### Processing Steps

1. **Load Visual Design Document**
   ```typescript
   const story = await storiesRepository.getStoryById(storyId);
   const visualDesignDoc = story.visualDesignDocument;
   ```

2. **Extract Referenced Image Paths and Validate**
   ```typescript
   // For each character ID in referencedDesigns.characters
   const characterPaths: string[] = [];
   for (const characterId of referencedDesigns.characters) {
     const design = visualDesignDoc.character_designs.find(d => d.character_id === characterId);
     const path = design?.character_model_sheet_image_path;

     if (!path || path.trim().length === 0) {
       throw new ShotImageTaskError(
         `Character '${characterId}' is referenced but has no character_model_sheet_image_path. ` +
         `Run CREATE_CHARACTER_MODEL_SHEET for this character first.`
       );
     }

     characterPaths.push(path);
   }

   // For each environment ID in referencedDesigns.environments
   const environmentPaths: string[] = [];
   for (const environmentId of referencedDesigns.environments) {
     const design = visualDesignDoc.environment_designs.find(d => d.environment_id === environmentId);
     const path = design?.environment_reference_image_path;

     if (!path || path.trim().length === 0) {
       throw new ShotImageTaskError(
         `Environment '${environmentId}' is referenced but has no environment_reference_image_path. ` +
         `Run CREATE_ENVIRONMENT_REFERENCE_IMAGE for this environment first.`
       );
     }

     environmentPaths.push(path);
   }
   ```

3. **Validate File Existence**
   ```typescript
   // For each path, verify the file exists before loading (fail if missing)
   const allPaths = [...characterPaths, ...environmentPaths];
   for (const path of allPaths) {
     const fullPath = join(basePublicPath, path);
     if (!existsSync(fullPath)) {
       throw new ShotImageTaskError(
         `Referenced image file does not exist: ${fullPath}`
       );
     }
   }
   ```

4. **Load Images**
   ```typescript
   const referenceImages = allPaths.map(path => {
     const buffer = fs.readFileSync(join(basePublicPath, path));
     return {
       data: buffer,
       mimeType: path.endsWith('.png') ? 'image/png' : 'image/jpeg'
     };
   });
   ```

5. **Generate Shot with References**
   ```typescript
   const result = await geminiImageClient.generateImage({
     userPrompt: shot.firstFramePrompt,
     referenceImages: referenceImages.slice(0, maxImages),
     aspectRatio: '16:9'
   });
   ```

### Output
- Array of reference image buffers ready for Gemini API
- Task fails if any referenced image path is missing or file doesn't exist

## Implementation Strategy

### Phase 1: Update Reference Image Recommender
Refactor `recommendReferenceImages` to accept visual design document as an alternative input source.

```typescript
interface ReferenceImageRecommenderInput {
  storyId: string;
  referencedDesigns: ReferencedDesigns;
  basePublicPath?: string;
  maxImages?: number;
  // NEW: Alternative to looking up visual reference package
  visualDesignDocument?: VisualDesignDocument;
}
```

### Phase 2: Update Shot Image Task
Modify `runShotImageTask` to load visual design document and pass it to the recommender.

```typescript
// Load visual design document
const visualDesignDoc = story.visualDesignDocument;
if (!visualDesignDoc) {
  throw new ShotImageTaskError(
    `Story ${storyId} does not have a visual design document.`
  );
}

// Use recommender with visual design document
const recommendations = recommendReferenceImages({
  storyId,
  referencedDesigns,
  visualDesignDocument: visualDesignDoc,
  maxImages: 5,
});
```

### Phase 3: Update Path Resolution Logic
Modify the recommender internals to read from visual design document when provided:

```typescript
function buildCharacterRecommendations(
  storyId: string,
  characterIds: string[],
  visualDesignDoc?: VisualDesignDocument,
  basePublicPath: string,
  validateFileExistence: boolean
): ReferenceImageRecommendation[] {
  const recommendations: ReferenceImageRecommendation[] = [];

  for (const characterId of characterIds) {
    let imagePath: string | undefined;

    if (visualDesignDoc) {
      // NEW PATH: Read from visual design document
      const design = visualDesignDoc.character_designs?.find(
        d => d.character_id === characterId
      );
      imagePath = design?.character_model_sheet_image_path;

      // STRICT: Fail if path is missing for referenced character
      if (!imagePath || imagePath.trim().length === 0) {
        throw new ReferenceImageRecommenderError(
          `Character '${characterId}' is referenced but has no character_model_sheet_image_path. ` +
          `Run CREATE_CHARACTER_MODEL_SHEET for this character first.`
        );
      }
    } else {
      // OLD PATH: Construct from pattern (deprecated)
      imagePath = `${storyId}/visuals/characters/${characterId}/character-model-sheet-1.png`;
    }

    const fullPath = join(basePublicPath, imagePath);

    if (validateFileExistence && !existsSync(fullPath)) {
      throw new ReferenceImageRecommenderError(
        `Character model sheet not found for '${characterId}': ${fullPath}`
      );
    }

    recommendations.push({
      type: 'CHARACTER',
      id: characterId,
      path: fullPath,
      description: `Character model sheet for ${characterId}`,
    });
  }

  return recommendations;
}
```

## Error Handling

### Missing Visual Design Document
```typescript
if (!story.visualDesignDocument) {
  throw new ShotImageTaskError(
    `Story ${storyId} does not have a visual design document. Run CREATE_VISUAL_DESIGN first.`
  );
}
```

### Missing Image Paths
Fail immediately if a referenced design is missing its image path:
```typescript
if (!imagePath || imagePath.trim().length === 0) {
  throw new ReferenceImageRecommenderError(
    `Character '${characterId}' is referenced but has no character_model_sheet_image_path. ` +
    `Run CREATE_CHARACTER_MODEL_SHEET for this character first.`
  );
}
```

### Missing Image Files
Current behavior maintained - throw error if path exists but file doesn't:
```typescript
if (validateFileExistence && !existsSync(fullPath)) {
  throw new ReferenceImageRecommenderError(
    `Character model sheet not found for '${characterId}': ${fullPath}`
  );
}
```

## Testing Strategy

### Unit Tests
1. Test `recommendReferenceImages` with visual design document input
2. Test graceful handling of missing image paths
3. Test prioritization (characters before environments)
4. Test max image limit enforcement

### Integration Tests
1. End-to-end shot generation with visual design document
2. Shot generation with mixed presence (some characters have images, some don't)
3. Verify no dependency on visual reference package

### Backward Compatibility Tests
1. Verify existing tests continue to pass
2. Ensure fallback path construction still works (for deprecation phase)

## Migration and Rollout

### No Database Migration Required
All changes are code-level; visual design document schema already supports the required fields.

### Deployment Steps
1. Deploy code changes (maintains backward compatibility)
2. Monitor shot generation tasks for errors
3. Verify new path resolution works correctly
4. Plan future deprecation of visual reference package (separate change)

## Future Work

### Visual Reference Package Deprecation
After this change is stable:
1. Remove visual reference package generation task
2. Remove visual reference package from database schema
3. Clean up related code and tests
4. Update documentation

This is explicitly **not** part of this change to keep scope manageable.
