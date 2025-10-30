# Design: Character Model Sheet Generation Task

## Architecture

### Component Structure

```
agent-backend/src/
├── character-model-sheet/
│   ├── characterModelSheetTask.ts    # Main task runner
│   ├── promptBuilder.ts               # Assembles structured prompt
│   ├── types.ts                       # Type definitions
│   └── errors.ts                      # Error classes
└── workflow/
    └── storyWorkflow.ts               # Add CREATE_CHARACTER_MODEL_SHEETS handler
```

### Data Flow

1. **CLI Invocation** → AgentWorkflowCli parses command with story-id, optional character-id, optional flags
2. **Task Initialization** → StoryWorkflow creates CharacterModelSheetTask with dependencies
3. **Data Loading** → Task fetches story record with visual_design_document from repository
4. **Prompt Assembly** → PromptBuilder extracts global_aesthetic and character_design, constructs structured prompt
5. **Image Generation** → GeminiImageClient generates 1:1 aspect ratio image using structured prompt
6. **Path Construction** → Build path: `<story-id>/visuals/characters/<character-id>/character-model-sheet.png`
7. **Image Storage** → ImageStorageService saves PNG to public directory
8. **Document Update** → Update visual_design_document with character_model_sheet_image_path
9. **Persistence** → StoriesRepository saves updated document immediately (per-character, not batched)

## Key Design Decisions

### Decision 1: Separate Task vs Extension

**Chosen**: Create new `CREATE_CHARACTER_MODEL_SHEETS` task type

**Rationale**:
- Clear separation of concerns - model sheets serve a different purpose than general reference images
- Different data storage (visual_design_document vs visual_reference_package)
- Different prompt structure (highly structured vs freeform)
- Allows independent invocation and iteration without affecting existing workflows
- Follows the requirement that "this task can be invoked from CLI" as a general task

### Decision 2: Storage Location for Image Paths

**Chosen**: Store `character_model_sheet_image_path` in `visual_design_document.character_designs[]`

**Rationale**:
- Visual design document is the source of truth for character designs
- Simpler data access pattern - all character metadata in one place
- Avoids cross-referencing between visual_design_document and visual_reference_package
- Aligns with the plan specification
- No schema migration needed (JSONB field update only)

**Path Location**:
```typescript
visual_design_document: {
  global_aesthetic: {...},
  character_designs: [
    {
      character_name: string,
      character_id: string,
      // ... existing fields
      character_model_sheet_image_path?: string  // NEW FIELD
    }
  ]
}
```

### Decision 3: Structured Prompt Format

**Chosen**: Use exact prompt template from plan document (`docs/018_visual_reference_image_structured_prompt_plan.md`)

**IMPORTANT**: The prompt MUST use the exact template specified in the plan. Do NOT modify, improve, or reinvent the prompt structure.

**Exact Template**:
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
        // Copy-paste entire global_aesthetic object from visual_design_document
        // Do not modify
    },
    "character_design": {
        // Copy-paste single character design object from character_designs array
        // Do not modify
    }
}
```

**Rationale**:
- Template is proven to solve style drift issues
- No system prompt needed - all instructions inline
- Direct data injection from visual_design_document ensures consistency
- Comments in JSON block are for documentation only (not sent to Gemini)

### Decision 4: Batch Mode Default

**Chosen**: Generate all characters by default, support `--character-id` for single targeting

**Rationale**:
- Aligns with user preference from clarification questions
- More convenient for initial generation workflow
- Consistent with CREATE_VISUAL_REFERENCE_IMAGES pattern
- `--resume` flag provides safe incremental generation

### Decision 5: Immediate Per-Character Persistence

**Chosen**: Update database immediately after each character image is generated

**Rationale**:
- Prevents data loss if batch operation fails mid-way
- Enables accurate `--resume` flag behavior
- Provides progress visibility during long-running batch operations
- Aligns with plan requirement: "save to db immediately after image generated"

**Trade-off**: Multiple database writes vs atomicity
- Accept multiple writes for reliability
- Each write is fast (JSONB update on single record)
- Failure mid-batch is recoverable via --resume

### Decision 6: Path Naming Convention

**Chosen**: Fixed filename `character-model-sheet.png` (no sequence number)

**Rationale**:
- Plan explicitly states "no sequence number at the end"
- One model sheet per character (primary reference)
- Simple, predictable path construction
- Consistent with task's focused scope

**Path Pattern**: `apps/story-tree-ui/public/generated/<story-id>/visuals/characters/<character-id>/character-model-sheet.png`

### Decision 7: Aspect Ratio

**Chosen**: Hard-coded 1:1 aspect ratio

**Rationale**:
- Plan requirement: "aspect ratio must be 1:1 (not the default 16:9)"
- Model sheets benefit from square format (turnarounds, expression grids)
- No need for configuration - this is a specialized task

### Decision 8: Override Flag Behavior

**Chosen**: `--override=false` (default) skips if image exists, `--override=true` regenerates

**Implementation**:
- Check for truthy `character_model_sheet_image_path` in visual_design_document
- If exists and override=false: skip generation
- If exists and override=true: generate new image, replace path
- Always verify file existence matches database state (log warning if mismatch)

### Decision 9: Resume Flag Behavior

**Chosen**: `--resume` flag in batch mode skips characters with existing model sheets

**Semantics**:
- Only valid in batch mode (no --character-id specified)
- Functionally equivalent to `--override=false` behavior
- Included for API consistency with CREATE_VISUAL_REFERENCE_IMAGES
- Explicit flag makes intent clearer in CLI usage

### Decision 10: Character ID Normalization

**Chosen**: Use existing `normalizeNameToId()` utility for character ID consistency

**Rationale**:
- Visual design document uses `character_id` field (normalized)
- File system paths require consistent, filesystem-safe identifiers
- Reuse existing normalization logic ensures consistency across codebase
- Character lookup by ID (not name) prevents ambiguity

## Error Handling

### Pre-flight Validation

1. **Story Not Found** → Throw descriptive error before any processing
2. **No Visual Design Document** → Throw error: "Story must have visual design document before generating model sheets"
3. **Empty Character Designs** → Throw error: "Visual design document contains no characters"
4. **Character Not Found** (single mode) → Throw error with available character IDs
5. **Invalid Override Value** → CLI validation, error with usage hint

### Generation Failures

1. **Gemini API Error** → Wrap in CharacterModelSheetTaskError with character context, preserve cause
2. **Image Storage Error** → Wrap with character context, don't update database on storage failure
3. **Database Update Error** → Throw error, note that image was generated successfully (path in error)

### Partial Batch Failures

- Continue processing remaining characters after individual failures
- Collect all errors and report summary at end
- Return count of successful generations
- Failed characters can be retried with --character-id or --resume

## Verbose Logging

### Decision 11: CLI --verbose Flag Behavior

**Chosen**: When `--verbose` flag is present, log detailed Gemini request (but NOT response image binary data)

**Log Output**:
- Log the complete assembled prompt sent to Gemini
- Log the request parameters (aspectRatio, timeout, retry settings)
- Log generation start/completion timestamps
- Do NOT log binary image data (useless in console output)
- Do log the saved file path after successful storage

**Implementation**:
- CLI passes verbose flag through to task dependencies
- Task logger checks verbose flag before detailed logging
- Use logger.debug() for verbose output (respects existing logging infrastructure)

## Testing Strategy

### Unit Tests

1. **Prompt Builder** (`promptBuilder.test.ts`)
   - Extracts global_aesthetic correctly from visual design document
   - Extracts character_design by character_id
   - Assembles complete structured prompt with base template + JSON
   - Handles missing optional fields gracefully
   - Validates JSON serialization in prompt

2. **Task Runner** (`characterModelSheetTask.test.ts`)
   - Validates story preconditions (exists, has visual design document)
   - Handles batch mode (all characters)
   - Handles single character mode
   - Respects override flag (skip vs regenerate)
   - Respects resume flag in batch mode
   - Constructs correct image paths
   - Updates visual_design_document with image path
   - Persists immediately after each generation
   - Handles Gemini errors gracefully
   - Handles storage errors without database corruption

### Integration Tests

1. **End-to-End Generation** (`characterModelSheetIntegration.test.ts`)
   - Generate model sheet for single character
   - Generate model sheets for all characters (batch)
   - Verify images saved to correct filesystem paths
   - Verify paths persisted in database
   - Verify aspect ratio is 1:1
   - Test --override=false skips existing images
   - Test --override=true regenerates existing images
   - Test --resume skips characters with existing sheets

2. **CLI Integration** (`agentWorkflowCli.test.ts`)
   - Parse CREATE_CHARACTER_MODEL_SHEETS command
   - Parse --character-id flag
   - Parse --override flag
   - Parse --resume flag
   - Validate flag combinations (--resume requires batch mode)

## Dependencies

### Existing Components (Reused)

- `GeminiImageClient` - Image generation (from `image-generation/geminiImageClient.ts`)
- `ImageStorageService` - File system persistence (from `image-generation/imageStorage.ts`)
- `AgentWorkflowStoriesRepository` - Database operations (from `workflow/types.ts`)
- `normalizeNameToId()` - Character ID normalization (existing utility)

### New Dependencies

None - all required infrastructure exists

## Migration Path

### Phase 1: Core Implementation
- Create character-model-sheet module
- Implement task runner and prompt builder
- Add CREATE_CHARACTER_MODEL_SHEETS to StoryWorkflow
- Write unit tests

### Phase 2: CLI Integration
- Add command parsing to agentWorkflowCli.ts
- Add flag validation (--character-id, --override, --resume)
- Update CLI help text
- Write CLI integration tests

### Phase 3: Documentation
- Update agent-backend/README.md with new task
- Add usage examples for batch and single modes
- Document flag behavior

### Phase 4: Validation
- Run openspec validate --strict
- Test end-to-end in development environment
- Verify database updates persist correctly

## Open Questions

None - all ambiguities resolved via user clarification questions.

## Future Considerations

1. **Prompt Tuning** - May need to iterate on structured prompt template based on generation quality
2. **Batch Parallelization** - Currently sequential; could parallelize for performance if needed
3. **Reference Image Support** - Could enhance with reference images from existing visual reference package
4. **Progress Callbacks** - Could add progress reporting for long-running batch operations
5. **Dry Run Mode** - Could add --dry-run flag to preview which characters would be processed
