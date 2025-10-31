# Design: Environment Reference Image Generation Task

## Architecture

### Component Structure

```
agent-backend/src/
├── environment-reference/
│   ├── environmentReferenceTask.ts     # Main task runner
│   ├── promptBuilder.ts                 # Assembles structured prompt
│   ├── types.ts                         # Type definitions
│   └── errors.ts                        # Error classes
└── workflow/
    └── storyWorkflow.ts                 # Add CREATE_ENVIRONMENT_REFERENCE_IMAGE handler
```

### Data Flow

1. **CLI Invocation** → AgentWorkflowCli parses command with story-id, optional environment-id, optional flags
2. **Task Initialization** → StoryWorkflow creates EnvironmentReferenceTask with dependencies
3. **Data Loading** → Task fetches story record with visual_design_document from repository
4. **Prompt Assembly** → PromptBuilder extracts global_aesthetic and environment_design, constructs structured prompt
5. **Image Generation** → GeminiImageClient generates 16:9 aspect ratio image using structured prompt
6. **Path Construction** → Build path: `<story-id>/visuals/environments/<environment-id>/environment-reference.png`
7. **Image Storage** → ImageStorageService saves PNG to public directory
8. **Document Update** → Update visual_design_document with environment_reference_image_path
9. **Persistence** → StoriesRepository saves updated document immediately (per-environment, not batched)

## Key Design Decisions

### Decision 1: Separate Task vs Extension

**Chosen**: Create new `CREATE_ENVIRONMENT_REFERENCE_IMAGE` task type

**Rationale**:
- Clear separation of concerns - environment reference images serve a different purpose than general reference images
- Different data storage (visual_design_document vs visual_reference_package)
- Different prompt structure (highly structured vs freeform)
- Allows independent invocation and iteration without affecting existing workflows
- Follows the requirement that "this task can be invoked from CLI" as a general task
- Mirrors the pattern established by CREATE_CHARACTER_MODEL_SHEETS

### Decision 2: Storage Location for Image Paths

**Chosen**: Store `environment_reference_image_path` in `visual_design_document.environment_designs[]`

**Rationale**:
- Visual design document is the source of truth for environment designs
- Simpler data access pattern - all environment metadata in one place
- Avoids cross-referencing between visual_design_document and visual_reference_package
- Aligns with the plan specification
- No schema migration needed (JSONB field update only)
- Consistent with character model sheet implementation

**Path Location**:
```typescript
visual_design_document: {
  global_aesthetic: {...},
  environment_designs: [
    {
      environment_name: string,
      environment_id: string,
      // ... existing fields
      environment_reference_image_path?: string  // NEW FIELD
    }
  ]
}
```

### Decision 3: Structured Prompt Format

**Chosen**: Use exact prompt template from plan document (`docs/019_visual_environment_plan.md`)

**IMPORTANT**: The prompt MUST use the exact template specified in the plan. Do NOT modify, improve, or reinvent the prompt structure.

**Exact Template**:
```
# Role: Environment Concept Artist

Your purpose is to generate high-fidelity environment reference images for film, animation, and game production. The output must serve as a precise visual guide for a specific scene.

# Core Directive: Strict Adherence to the User's Prompt

Your most critical function is to create an image that is a direct and literal visualization of the user's request.

*   **Analyze:** Deconstruct the user's prompt to identify every specified element: objects, lighting, atmosphere, color palette, camera angle, and composition.
*   **Construct:** Build the scene using *only* the elements explicitly mentioned.
*   **Omit:** Do not add, invent, or infer any objects, characters, animals, or environmental details that are not described in the prompt. Your role is to be a precise tool, not an interpretive artist.

{
    "global_aesthetic": {
        // Copy-paste entire global_aesthetic object from visual_design_document
        // Do not modify
    },
    "environment_design": {
        // Copy-paste single environment design object from environment_designs array
        // Do not modify - includes: environment_id, detailed_description with
        // color_tones, key_elements, overall_description, lighting_and_atmosphere
    }
}
```

**Rationale**:
- Template is designed to solve style drift issues for environments
- No system prompt needed - all instructions inline
- Direct data injection from visual_design_document ensures consistency
- Comments in JSON block are for documentation only (not sent to Gemini)
- The Role and Core Directive guide Gemini to strict adherence to the visual design

### Decision 4: Batch Mode Default

**Chosen**: Generate all environments by default, support `--environment-id` for single targeting

**Rationale**:
- Aligns with plan requirement for batch and single modes
- More convenient for initial generation workflow
- Consistent with CREATE_CHARACTER_MODEL_SHEETS and CREATE_VISUAL_REFERENCE_IMAGES patterns
- `--resume` flag provides safe incremental generation

### Decision 5: Immediate Per-Environment Persistence

**Chosen**: Update database immediately after each environment image is generated

**Rationale**:
- Plan explicitly requires: "path should be saved to db immediately after the image is generated successfully"
- Prevents data loss if batch operation fails mid-way
- Enables accurate `--resume` flag behavior
- Provides progress visibility during long-running batch operations
- Consistent with character model sheet implementation

**Trade-off**: Multiple database writes vs atomicity
- Accept multiple writes for reliability
- Each write is fast (JSONB update on single record)
- Failure mid-batch is recoverable via --resume

### Decision 6: Path Naming Convention

**Chosen**: Fixed filename `environment-reference.png` (no sequence number)

**Rationale**:
- Plan explicitly states "no sequence number at the end"
- One reference image per environment (primary reference)
- Simple, predictable path construction
- Consistent with task's focused scope

**Path Pattern**: `apps/story-tree-ui/public/generated/<story-id>/visuals/environments/<environment-id>/environment-reference.png`

### Decision 7: Aspect Ratio

**Chosen**: Hard-coded 16:9 aspect ratio (default)

**Rationale**:
- Plan requirement: "aspect ratio must be 16:9 (the default aspect ratio)"
- Environment reference images benefit from wide format (landscape scenes)
- No need for configuration - this is a specialized task
- Consistent with typical environment concept art aspect ratios

### Decision 8: Override Flag Behavior

**Chosen**: `--override=false` (default) skips if image exists, `--override=true` regenerates

**Implementation**:
- Check for truthy `environment_reference_image_path` in visual_design_document
- If exists and override=false: skip generation
- If exists and override=true: generate new image, replace path
- Always verify file existence matches database state (log warning if mismatch)

### Decision 9: Resume Flag Behavior

**Chosen**: `--resume` flag in batch mode skips environments with existing reference images

**Semantics**:
- Only valid in batch mode (no --environment-id specified)
- Plan requirement: "support --resume flag - only generate image for environments without model sheet image yet"
- Functionally equivalent to `--override=false` behavior
- Included for API consistency with CREATE_CHARACTER_MODEL_SHEETS
- Explicit flag makes intent clearer in CLI usage

### Decision 10: Environment ID Source

**Chosen**: Use `environment_id` field from visual_design_document

**Rationale**:
- Visual design document already includes `environment_id` field
- File system paths require consistent, filesystem-safe identifiers
- Environment lookup by ID (not name) prevents ambiguity
- Consistent with character model sheet implementation
- The ID is generated during visual design document creation

### Decision 11: No System Prompt

**Chosen**: Use inline prompt only, no separate system prompt file

**Rationale**:
- Plan explicitly states: "no system prompt"
- All guidance included in the user prompt
- Simpler implementation - no additional file to maintain
- Self-contained prompt makes testing easier
- Consistent with plan's exact prompt template requirement

## Error Handling

### Pre-flight Validation

1. **Story Not Found** → Throw descriptive error before any processing
2. **No Visual Design Document** → Throw error: "Story must have visual design document before generating environment reference images"
3. **Empty Environment Designs** → Throw error: "Visual design document contains no environments"
4. **Environment Not Found** (single mode) → Throw error with available environment IDs
5. **Invalid Override Value** → CLI validation, error with usage hint

### Generation Failures

1. **Gemini API Error** → Wrap in EnvironmentReferenceTaskError with environment context, preserve cause
2. **Image Storage Error** → Wrap with environment context, don't update database on storage failure
3. **Database Update Error** → Throw error, note that image was generated successfully (path in error)

### Partial Batch Failures

- Continue processing remaining environments after individual failures
- Collect all errors and report summary at end
- Return count of successful generations
- Failed environments can be retried with --environment-id or --resume

## Verbose Logging

### Decision 12: CLI --verbose Flag Behavior

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
   - Extracts environment_design by environment_id
   - Assembles complete structured prompt with base template + JSON
   - Handles missing optional fields gracefully
   - Validates JSON serialization in prompt

2. **Task Runner** (`environmentReferenceTask.test.ts`)
   - Validates story preconditions (exists, has visual design document)
   - Handles batch mode (all environments)
   - Handles single environment mode
   - Respects override flag (skip vs regenerate)
   - Respects resume flag in batch mode
   - Constructs correct image paths
   - Updates visual_design_document with image path
   - Persists immediately after each generation
   - Handles Gemini errors gracefully
   - Handles storage errors without database corruption

### Integration Tests

1. **End-to-End Generation** (`environmentReferenceIntegration.test.ts`)
   - Generate reference image for single environment
   - Generate reference images for all environments (batch)
   - Verify images saved to correct filesystem paths
   - Verify paths persisted in database
   - Verify aspect ratio is 16:9
   - Test --override=false skips existing images
   - Test --override=true regenerates existing images
   - Test --resume skips environments with existing images

2. **CLI Integration** (`agentWorkflowCli.test.ts`)
   - Parse CREATE_ENVIRONMENT_REFERENCE_IMAGE command
   - Parse --environment-id flag
   - Parse --override flag
   - Parse --resume flag
   - Validate flag combinations (--resume requires batch mode)

## Dependencies

### Existing Components (Reused)

- `GeminiImageClient` - Image generation (from `image-generation/geminiImageClient.ts`)
- `ImageStorageService` - File system persistence (from `image-generation/imageStorage.ts`)
- `AgentWorkflowStoriesRepository` - Database operations (from `workflow/types.ts`)

### New Dependencies

None - all required infrastructure exists

## Migration Path

### Phase 1: Core Implementation
- Create environment-reference module
- Implement task runner and prompt builder
- Add CREATE_ENVIRONMENT_REFERENCE_IMAGE to StoryWorkflow
- Write unit tests

### Phase 2: CLI Integration
- Add command parsing to agentWorkflowCli.ts
- Add flag validation (--environment-id, --override, --resume)
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

None - all requirements are clearly specified in the plan document.

## Future Considerations

1. **Prompt Tuning** - May need to iterate on structured prompt template based on generation quality
2. **Batch Parallelization** - Currently sequential; could parallelize for performance if needed
3. **Reference Image Support** - Could enhance with reference images from existing visual reference package
4. **Progress Callbacks** - Could add progress reporting for long-running batch operations
5. **Dry Run Mode** - Could add --dry-run flag to preview which environments would be processed
