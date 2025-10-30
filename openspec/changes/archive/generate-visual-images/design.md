# generate-visual-images Design

## Architecture Overview

This change extends the workflow orchestrator with two new tasks that generate images using Gemini's image generation API and persist them to the filesystem. The architecture follows the established task pattern with injected dependencies for testability.

### Component Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ Workflow Orchestrator (storyWorkflow.ts)                        │
│ - CREATE_VISUAL_REFERENCE_IMAGES task                           │
│ - CREATE_SHOT_IMAGES task                                       │
│ - Prerequisite validation & resume mode                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Task Implementations                                             │
│ - visualReferenceImageTask.ts: character & environment images   │
│ - shotImageTask.ts: storyboard frame generation                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Gemini Image Client (geminiImageClient.ts)                      │
│ - generateImage(prompt, referenceImages[], config)              │
│ - Returns: Buffer (PNG/JPG binary data)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ File System Storage (imageStorage.ts)                           │
│ - saveImage(buffer, storyId, category, filename)                │
│ - Returns: relative path from public/generated/                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Database Persistence                                             │
│ - Stories table: visual_reference_package (with image_path)     │
│ - Shots table: image_path column (new)                          │
└─────────────────────────────────────────────────────────────────┘
```

## File System Layout

### Directory Structure

```
apps/story-tree-ui/public/generated/
└── <story-id>/
    ├── visuals/
    │   ├── characters/
    │   │   ├── <character-name>/
    │   │   │   ├── model_sheet_1.png
    │   │   │   ├── model_sheet_2.png
    │   │   │   └── ...
    │   └── environments/
    │       ├── <environment-name>/
    │       │   ├── keyframe_1.png
    │       │   ├── keyframe_2.png
    │       │   └── ...
    └── shots/
        ├── <scenelet-id>_shot_1_first_frame.png
        ├── <scenelet-id>_shot_1_key_frame.png
        ├── <scenelet-id>_shot_2_first_frame.png
        ├── <scenelet-id>_shot_2_key_frame.png
        └── ...
```

### Path Format Examples

**Visual References**:
- Character: `<story-id>/visuals/characters/cosmo-the-coder/model_sheet_1.png`
- Environment: `<story-id>/visuals/environments/jungle-workshop/keyframe_1.png`

**Shot Images**:
- First Frame: `<story-id>/shots/scenelet-1_shot_1_first_frame.png`
- Key Frame: `<story-id>/shots/scenelet-1_shot_1_key_frame.png`

### Database Storage

Paths stored in the database are **relative to `public/generated/`**:

**Visual Reference Package** (in `stories.visual_reference_package` JSONB):
```json
{
  "character_model_sheets": [
    {
      "character_name": "Cosmo the Coder",
      "sheets": [
        {
          "sheet_type": "CHARACTER_MODEL_SHEET",
          "image_generation_prompt": "...",
          "image_path": "abc-123-story/visuals/characters/cosmo-the-coder/model_sheet_1.png"
        }
      ]
    }
  ]
}
```

**Shot Image Paths** (in `shots` table columns):
- `first_frame_image_path`: `abc-123-story/shots/scenelet-1_shot_1_first_frame.png`
- `key_frame_image_path`: `abc-123-story/shots/scenelet-1_shot_1_key_frame.png`

## Gemini Image Client Design

### Interface

```typescript
interface GeminiImageClient {
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

interface ImageGenerationRequest {
  userPrompt: string;
  systemInstruction?: string;
  referenceImages?: ReferenceImage[];
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3' | '2:3' | '3:2' | '4:5' | '5:4' | '21:9';
  timeoutMs?: number;
}

interface ReferenceImage {
  data: Buffer;  // PNG/JPG binary
  mimeType: 'image/png' | 'image/jpeg';
}

interface ImageGenerationResult {
  imageData: Buffer;
  mimeType: string;
}
```

### Key Design Decisions

**System Instruction Support**: User confirmed that system instructions work well with Gemini image generation and improve consistency with reference images. We'll use `system_prompts/visual_renderer.md` for shot generation.

**Reference Image Limit**: Gemini API recommends max 3 input images. For shot generation:
1. Prioritize CHARACTER_MODEL_SHEET images first
2. Include additional character plates if under limit
3. Error if a required character has no model sheets

**Aspect Ratio Defaults**:
- Visual references: `16:9` (cinematic, consistent with shots)
- Shots: `16:9` (cinematic, matches shot_suggestions format)
- **Note**: All images use 16:9 for now. The client supports configurable aspect ratios for future flexibility.

**Retry Logic**: Reuse existing `executeGeminiWithRetry` infrastructure with rate limit handling.

## Task Implementation Details

### CREATE_VISUAL_REFERENCE_IMAGES Task

**Prerequisites**:
- Story has `visual_reference_package` (from CREATE_VISUAL_REFERENCE task)
- No existing images in `visual_reference_package[*].image_path` (unless resume mode)

**Process**:
1. Load `visual_reference_package` from story record
2. For each character in `character_model_sheets`:
   - For each sheet without `image_path` (or all if not resume):
     - Call Gemini image generation with `image_generation_prompt`
     - Save image to `visuals/characters/<normalized-name>/model_sheet_N.png`
     - Update sheet with `image_path`
3. For each environment in `environment_keyframes`:
   - For each keyframe without `image_path`:
     - Call Gemini image generation with `image_generation_prompt`
     - Save image to `visuals/environments/<normalized-name>/keyframe_N.png`
     - Update keyframe with `image_path`
4. Persist updated `visual_reference_package` to database

**Resume Mode**: Check for existing `image_path` fields; skip already-generated images.

### CREATE_SHOT_IMAGES Task

**Prerequisites**:
- Story has shots (from CREATE_SHOT_PRODUCTION task)
- Story has `visual_reference_package` with character image paths
- Visual reference images must exist on filesystem

**Process**:
1. Load all shots for story via shots repository
2. Load `visual_reference_package` for reference image lookup
3. For each shot missing images (or all if not resume):
   - Parse `storyboard_payload` to extract character names
   - Load character reference images from filesystem (max 3, prioritize model sheets)
   - **Generate first frame image**:
     - Call Gemini with system instruction, `first_frame_prompt`, and reference images
     - Save to `shots/<scenelet-id>_shot_<index>_first_frame.png`
     - Update `first_frame_image_path` column
   - **Generate key frame image**:
     - Call Gemini with system instruction, `key_frame_prompt`, and reference images
     - Save to `shots/<scenelet-id>_shot_<index>_key_frame.png`
     - Update `key_frame_image_path` column

**Character Reference Lookup**:
- Match character names (case-insensitive, normalized)
- Prefer CHARACTER_MODEL_SHEET entries first
- Include additional plates if under 3-image limit
- **Fail fast** if any required character has no reference images

**Resume Mode**: Query shots repository for shots missing either `first_frame_image_path` or `key_frame_image_path`. Only generate missing images.

## Database Schema Changes

### Shots Table

Add two new columns for first frame and key frame images:

```sql
ALTER TABLE public.shots
ADD COLUMN first_frame_image_path TEXT,
ADD COLUMN key_frame_image_path TEXT;
```

**Fields**:
- `first_frame_image_path` (nullable TEXT): Relative path from `public/generated/` root to the first frame image
- `key_frame_image_path` (nullable TEXT): Relative path from `public/generated/` root to the key frame image

### Stories Table

**No schema changes needed**. The `visual_reference_package` JSONB column already exists and will store `image_path` fields nested within the JSON structure at:
- `character_model_sheets[*].sheets[*].image_path`
- `environment_keyframes[*].keyframes[*].image_path`

## Configuration & Environment

### New Environment Variables

```bash
# Gemini image generation model (default: gemini-2.5-flash-image)
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

# Image generation timeout in ms (default: 60000)
GEMINI_IMAGE_TIMEOUT_MS=60000

# Default aspect ratio for visual references (default: 16:9)
VISUAL_REFERENCE_ASPECT_RATIO=16:9

# Default aspect ratio for shots (default: 16:9)
SHOT_IMAGE_ASPECT_RATIO=16:9
```

### .gitignore Updates

Add to `.gitignore`:

```
# Generated images (large binary files, regenerate locally)
apps/story-tree-ui/public/generated/
```

## Error Handling

### Validation Errors

- **Missing prerequisites**: Throw descriptive error before calling Gemini
- **Character name mismatch**: Fail immediately if shot references unknown character
- **Missing reference files**: Fail if expected image file doesn't exist on disk

### Gemini API Errors

- **Rate limits**: Retry with exponential backoff (via existing retry logic)
- **Timeouts**: Configurable timeout, surface error with task context
- **Invalid responses**: Log raw response (redacted), throw descriptive error

### File System Errors

- **Disk space**: Catch and surface ENOSPC errors clearly
- **Permissions**: Validate write access to `public/generated/` on task start
- **Path traversal**: Sanitize filenames (remove `..`, `/`, etc.)

## Testing Strategy

### Unit Tests

- **Gemini Image Client**: Mock transport, test request/response mapping
- **Image Storage**: Use temp directories, verify path generation and file writes
- **Task Logic**: Inject fake repositories and client, verify call sequences
- **Resume Mode**: Test skipping already-generated images

### Integration Tests

- **Visual Reference Task**: Use fixture response, verify files created and DB updated
- **Shot Image Task**: Mock reference image loading, verify Gemini receives correct inputs
- **CLI**: Test `run-task` and `run-all` with stub mode

### Manual Testing

- Run against real Gemini API with small story
- Inspect generated images for quality
- Verify UI can load and display images via Next.js static serving

## Rollout Plan

1. **Phase 1**: Implement Gemini image client with unit tests
2. **Phase 2**: Add CREATE_VISUAL_REFERENCE_IMAGES task with integration tests
3. **Phase 3**: Add shots table migration and CREATE_SHOT_IMAGES task
4. **Phase 4**: Update CLI to support new tasks
5. **Phase 5**: Manual QA with real API, adjust prompts if needed

## Open Questions

None remaining after user clarification.
