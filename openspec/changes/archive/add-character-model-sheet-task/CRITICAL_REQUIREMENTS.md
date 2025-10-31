# Critical Implementation Requirements

## 1. EXACT PROMPT TEMPLATE - DO NOT MODIFY

**Source**: `docs/018_visual_reference_image_structured_prompt_plan.md`

**REQUIREMENT**: The prompt builder MUST use the exact template below. Do NOT modify, improve, or reinvent it.

### Exact Template to Use:

```
Character model sheet, character design sheet, concept art for animation, professional production art.
A 3-row grid layout.
**Top row:** Full body character turnaround in a T-pose. Clean orthographic views showing front, left side, right side, and back.
**Middle row:** Four headshots demonstrating key facial expressions: neutral, happy, sad, angry.
**Bottom row:** Four dynamic action poses: a ready stance, a walking pose, a running pose, and a jumping pose.
**Style:** Clean digital painting, detailed character render, full color, clear lines.
**Lighting & Background:** Bright, even studio lighting with soft shadows, set against a solid neutral gray background for maximum clarity.
**Constraint:** The image must not contain any text, letters, numbers, annotations, or watermarks. Purely visual with no typography.

{
    "global_aesthetic": {
        // Extract entire global_aesthetic object from visual_design_document
        // Include visual_style and master_color_palette
        // Copy as-is, do not modify
    },
    "character_design": {
        // Extract single character design object from character_designs array
        // Match by character_id
        // Copy as-is, do not modify
    }
}
```

**Notes**:
- The template is a literal string constant in the code
- The JSON block comments are for documentation only - do NOT include comments in the actual prompt sent to Gemini
- Extract and serialize the actual objects from visual_design_document into the JSON block

### Implementation Location:

`agent-backend/src/character-model-sheet/promptBuilder.ts` - `buildModelSheetPrompt()` function

### Unit Test Requirement:

Test MUST verify the assembled prompt matches the exact template word-for-word (excluding the JSON data which varies per character).

---

## 2. VERBOSE LOGGING - LOG REQUEST, NOT BINARY DATA

**REQUIREMENT**: When CLI `--verbose` flag is present, log detailed Gemini request information but exclude binary image data.

### What to Log (when verbose=true):

✅ **DO LOG**:
- Complete assembled prompt text (before sending to Gemini)
- Request parameters: aspectRatio='1:1', timeout, retry settings
- Character ID being processed
- Generation start timestamp
- Generation completion timestamp
- Image metadata: size in bytes, mime type
- Saved file path after successful storage

❌ **DO NOT LOG**:
- Binary image data (Buffer contents)
- Raw image bytes
- Base64 encoded image (unless specifically for debugging and truncated)

### Implementation Notes:

1. **CLI Integration** (`agent-backend/src/cli/agentWorkflowCli.ts`):
   - Pass existing `verbose` flag from CLI options to `characterModelSheetTaskOptions`
   - Verbose flag should flow through to task dependencies

2. **Task Runner** (`agent-backend/src/character-model-sheet/characterModelSheetTask.ts`):
   - Accept verbose flag in dependencies (or check if logger supports debug level)
   - Before calling `geminiClient.generateImage()`:
     - If verbose: `logger.debug('Generating character model sheet', { characterId, prompt, aspectRatio, timeout })`
   - After receiving image data:
     - If verbose: `logger.debug('Image generated', { characterId, sizeBytes: imageData.length })`
   - After saving:
     - If verbose: `logger.debug('Image saved', { characterId, path: savedPath })`

3. **Default Behavior** (verbose=false):
   - Log only summary: number of characters processed, success/failure counts
   - No detailed prompt or parameter logging

### Why This Matters:

- Binary data in console output is useless and clutters logs
- Full prompt logging helps debug style drift issues
- Request parameters help diagnose generation failures
- File paths confirm successful storage

### Example Verbose Output:

```
[DEBUG] Generating character model sheet for character: wizard-merlin
[DEBUG] Prompt: Character model sheet, character design sheet, concept art for animation...
        {JSON data block}
[DEBUG] Request params: aspectRatio=1:1, timeout=120000ms
[DEBUG] Image generated: 1.2MB (1248576 bytes)
[DEBUG] Image saved: story-abc/visuals/characters/wizard-merlin/character-model-sheet.png
```

### Example Non-Verbose Output:

```
[INFO] Character model sheets: 3 generated, 0 skipped, 0 failed
```

---

## Validation Checklist

Before submitting implementation for review:

- [ ] Prompt template matches exactly (word-for-word) the template in `docs/018_visual_reference_image_structured_prompt_plan.md`
- [ ] Unit test verifies exact prompt template is used
- [ ] Verbose logging logs full prompt text when enabled
- [ ] Verbose logging logs request parameters when enabled
- [ ] Verbose logging does NOT log binary image data
- [ ] Non-verbose mode uses minimal logging (summary only)
- [ ] CLI `--verbose` flag flows through to task dependencies
