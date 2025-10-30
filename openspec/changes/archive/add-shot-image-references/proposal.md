## Why

When generating shot images for production, the system currently has no mechanism to provide reference images to guide visual consistency. This causes character and environment designs to drift from the established visual reference package, resulting in inconsistent imagery across shots. The system needs to automatically identify and upload relevant character and environment reference images to Gemini when generating shot images.

## What Changes

- **Fix shot production parser** to preserve `referenced_designs` field from Gemini response (currently being dropped)
- Add reference image recommendation logic that identifies which character model sheets and environment keyframes should be used for a given shot based on the `referenced_designs` field
- Extend Gemini image client to support uploading reference images alongside generation prompts
- Add verbose logging to report which reference images are uploaded for each shot generation
- Design the system with clear separation between recommendation logic (which images to use) and consumption logic (how to upload and use them)

## Impact

- **Affected specs:** story-workflow
- **Affected code:**
  - `agent-backend/src/shot-production/parseGeminiResponse.ts` - fix to preserve `referenced_designs`
  - `agent-backend/src/shot-production/types.ts` - add `referencedDesigns` to storyboard interface
  - `agent-backend/src/image-generation/geminiImageClient.ts` - extend for reference image uploads
  - New module `agent-backend/src/reference-images/` for reference image recommendation logic
