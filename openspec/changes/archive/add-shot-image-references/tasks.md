## 1. Shot Production Response Parser Fix
- [x] 1.1 Define `ReferencedDesigns` interface in `types.ts` with `characters` and `environments` arrays
- [x] 1.2 Add optional `referencedDesigns` field to `ShotProductionStoryboardEntry` interface
- [x] 1.3 Add `referenced_designs` and `referencedDesigns` fields to `RawStoryboardEntry` interface
- [x] 1.4 Update `sanitizeStoryboard` function to extract and validate `referenced_designs`
- [x] 1.5 Add validation helper to ensure character/environment IDs are string arrays
- [x] 1.6 Write parser tests with fixtures containing `referenced_designs`
- [x] 1.7 Write parser tests for missing `referenced_designs` (backward compatibility)

## 2. Reference Image Recommender Module
- [x] 2.1 Create `agent-backend/src/reference-images/` directory
- [x] 2.2 Implement `referenceImageRecommender.ts` with recommendation logic
- [x] 2.3 Define TypeScript interfaces for recommendation input/output
- [x] 2.4 Implement character model sheet path resolution (pattern: `character-model-sheet-1.png`)
- [x] 2.5 Implement environment keyframe path resolution (pattern: `keyframe_1.png`)
- [x] 2.6 Implement prioritization logic (characters first, max 5 total)
- [x] 2.7 Implement file existence validation with descriptive errors
- [x] 2.8 Write comprehensive unit tests for recommender logic

## 3. Gemini Image Client Extension
- [x] 3.1 Add `referenceImages` optional parameter to `GenerateImageOptions` interface
- [x] 3.2 Implement file reading and base64 conversion for reference images
- [x] 3.3 Add reference images as `inlineData` parts in Gemini request before text prompt
- [x] 3.4 Handle file read errors with descriptive exceptions
- [x] 3.5 Write unit tests for Gemini client with reference image uploads

## 4. Shot Image Generation Task Integration
- [x] 4.1 Import and use reference image recommender in shot image generation task
- [x] 4.2 Call recommender with shot's `referencedDesigns` from storyboard payload and visual reference package
- [x] 4.3 Pass recommended images to Gemini image client
- [x] 4.4 Add verbose logging for reference images (format: `[Shot <id> #<index>] Using reference images...`)
- [x] 4.5 Handle missing `referencedDesigns` gracefully (skip upload if undefined)
- [x] 4.6 Write integration tests for shot image generation with reference images

## 5. End-to-End Validation
OPTIONAL: I will do this manually
- [ ] 5.1 Run shot production task to generate shots with `referenced_designs`
- [ ] 5.2 Verify `referenced_designs` is persisted in `storyboard_payload` JSONB
- [ ] 5.3 Run shot image generation task with `--verbose` flag
- [ ] 5.4 Verify reference images are logged correctly
- [ ] 5.5 Verify generated shot images show visual consistency with reference images
- [ ] 5.6 Test with missing reference images and verify descriptive error

## 6. Documentation
- [x] 6.1 Update CLI help text for shot image generation to mention reference images
- [x] 6.2 Document reference image file path patterns
- [x] 6.3 Add troubleshooting guide for missing reference images
