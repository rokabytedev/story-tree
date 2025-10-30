## Context

Shot image generation currently produces images without visual guidance from the established character and environment designs. The system has a visual reference package containing character model sheets and environment keyframes, but this data is not utilized during shot generation. This proposal introduces a reference image system that automatically identifies and uploads relevant reference images to Gemini when generating shot images.

The design must address:
1. **Bug fix:** Why `referenced_designs` is being dropped by the shot production parser
2. How to recommend which reference images to use for a given shot
3. How to locate reference image files on disk
4. How to upload reference images to Gemini alongside generation prompts
5. How to provide visibility into which reference images are being used (verbose mode)

## Goals / Non-Goals

**Goals:**
- **Fix the parser** to preserve `referenced_designs` in `storyboard_payload` (currently being dropped)
- Automatically recommend reference images based on shot's `referenced_designs` metadata
- Upload character model sheets and environment keyframes to Gemini during shot image generation
- Provide clear separation between recommendation logic and upload/consumption logic
- Log reference image paths in verbose mode for debugging
- Prioritize character images when hitting upload limits

**Non-Goals:**
- Implementing smart image cropping or preprocessing
- Caching uploaded images across multiple Gemini requests
- Supporting custom reference image selection by users
- Generating new reference images if missing (fail with clear error instead)
- Implementing reference images for video generation (future work)

## Decisions

### Fix Shot Production Parser

**Problem:** The `sanitizeStoryboard` function in `parseGeminiResponse.ts` only extracts specific fields defined in the `ShotProductionStoryboardEntry` interface. The Gemini Shot Director system prompt instructs the model to include `referenced_designs` in each shot's `storyboard_entry`, but this field is currently being dropped during parsing.

**Root cause:**
1. `ShotProductionStoryboardEntry` interface (types.ts:80-88) doesn't include `referencedDesigns` field
2. `sanitizeStoryboard` function (parseGeminiResponse.ts:163-207) only extracts known fields
3. Result: `referenced_designs` from Gemini response is silently discarded

**Solution:**
1. Add `referencedDesigns` optional field to `ShotProductionStoryboardEntry` interface with proper typing
2. Update `sanitizeStoryboard` to extract and pass through `referenced_designs` from raw response
3. Add validation to ensure IDs are arrays of strings
4. No database changes needed - `storyboard_payload` is already JSONB and will automatically store the field

**Type definition:**
```typescript
interface ReferencedDesigns {
  characters: string[];
  environments: string[];
}

interface ShotProductionStoryboardEntry {
  // ... existing fields ...
  referencedDesigns?: ReferencedDesigns;
}
```

### Reference Image Recommendation Strategy

**Decision:** Create a dedicated `referenceImageRecommender` module that takes a shot's `referenced_designs` and returns a prioritized list of file paths.

**Rationale:**
- Separates recommendation heuristics from Gemini client logic
- Makes it easy to adjust recommendation rules without touching API code
- Enables unit testing of recommendation logic independently
- Allows future enhancements (e.g., user overrides, ML-based selection)

**Algorithm:**
1. Extract `character_ids` and `environment_ids` from `storyboard_entry.referenced_designs`
2. For each character_id, look up the visual reference package and find the character model sheet
3. Select the first `CHARACTER_MODEL_SHEET` plate (name pattern: `character-model-sheet-1.png`)
4. For each environment_id, find the first keyframe (name pattern: `keyframe_1.png` if exists)
5. Apply upload limit (default: 5 images, prioritize characters over environments)
6. Return ordered list of `{type, id, path, description}` tuples

### File Path Resolution

**Decision:** Reference images are stored in `apps/story-tree-ui/public/generated/<story-id>/visuals/...` following the existing visual reference image task conventions.

**Path patterns:**
- Character model sheets: `<story-id>/visuals/characters/<character-id>/character-model-sheet-1.png`
- Environment keyframes: `<story-id>/visuals/environments/<environment-id>/keyframe_1.png`

**Rationale:**
- Reuses existing image storage structure from visual reference image task
- Makes paths predictable for debugging
- Enables future web UI to display reference images directly

### Gemini Client Extension

**Decision:** Extend `geminiImageClient` to accept optional `referenceImages: Array<{path: string, mimeType: string}>` parameter.

**Signature:**
```typescript
interface GenerateImageOptions {
  prompt: string;
  systemInstruction?: string;
  aspectRatio?: ImageAspectRatio;
  referenceImages?: Array<{path: string; mimeType: string}>;
}
```

**Implementation approach:**
- Read reference image files from disk and convert to base64
- Add as `inlineData` parts in the user message before the text prompt
- Gemini API will use these as visual context for generation

**Rationale:**
- Keeps API changes minimal and backward-compatible
- Follows Gemini's multimodal input pattern (images + text)
- Allows different tasks to opt-in to reference images independently

### Verbose Logging

**Decision:** When `--verbose` flag is set, log reference image details before each shot generation:
```
[Shot scenelet-3 #1] Using reference images:
  - CHARACTER: cosmo -> visuals/characters/cosmo/character-model-sheet-1.png
  - ENVIRONMENT: jungle-workshop -> visuals/environments/jungle-workshop/keyframe_1.png
```

**Rationale:**
- Provides immediate visibility into reference image usage
- Helps diagnose missing or incorrect reference images
- Follows existing verbose logging pattern in shot production task

### Upload Limit and Prioritization

**Decision:** Limit reference image uploads to 5 images per shot, prioritizing characters over environments.

**Rationale:**
- Avoids hitting Gemini API limits or degrading performance
- Characters are more critical for visual consistency than environments
- Plan document explicitly states "prefer including character images if already more than the limit"

**Algorithm:**
1. Collect all character model sheet images
2. Collect environment keyframe images
3. If total ≤ 5, use all
4. Otherwise, take all character images first, then fill remaining slots with environments
5. If still exceeds 5, truncate (characters take priority)

## Risks / Trade-offs

**Risk:** Reference images may not exist on disk when shot generation runs.

**Mitigation:** Validate that all referenced image files exist before calling Gemini. Fail fast with descriptive error listing missing paths.

**Risk:** Gemini may not effectively use reference images or may require specific prompt phrasing.

**Mitigation:** Add reference image usage instructions to the user prompt. Monitor generated images and iterate on prompt wording if needed.

**Risk:** `referenced_designs` may not be populated in `storyboard_payload` for shots generated before the parser fix.

**Mitigation:** Reference image recommender gracefully handles missing or undefined `referencedDesigns` and proceeds without reference images. Only shots generated after the parser fix will have this data.

**Trade-off:** Uploading images increases Gemini request latency and cost.

**Acceptance:** Visual consistency gains outweigh performance cost. Future optimization can cache uploads or use Gemini's file API.

## Migration Plan

1. **Fix shot production parser:** Update types and parser to preserve `referenced_designs`
2. **Implement reference recommender:** Build standalone module with unit tests
3. **Extend Gemini client:** Add reference image upload support with tests
4. **Wire up shot image generation:** Integrate recommender and pass images to Gemini client
5. **Test end-to-end:** Generate shot images with reference images and verify consistency
6. **Document usage:** Update CLI help and workflow documentation

**Rollback:** The parser fix is backward compatible (field is optional). Reference image upload can be disabled by skipping the recommender call. Shots without `referenced_designs` continue to work as before.

## Open Questions

1. **Q:** Should we support environment images when no environment keyframe_1 exists?
   **A:** No, for now fail if `keyframe_1` is missing but environment is referenced. This keeps logic simple and encourages complete reference packages.

2. **Q:** Should reference images be uploaded for first frame, key frame, or video generation?
   **A:** Start with first frame and key frame (static images). Video generation with references is future work.

3. **Q:** What happens if a character is referenced but has no `CHARACTER_MODEL_SHEET` plate?
   **A:** Fail with clear error. The visual reference package should always include model sheets for referenced characters.
