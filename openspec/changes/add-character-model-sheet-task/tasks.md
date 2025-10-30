# Implementation Tasks

## Milestone 1: Core Module Setup

- [ ] Create `agent-backend/src/character-model-sheet/` directory
- [ ] Create `agent-backend/src/character-model-sheet/types.ts` with:
  - CharacterModelSheetTaskDependencies interface
  - CharacterModelSheetTaskOptions type
  - CharacterModelSheetTaskResult interface
  - CharacterModelSheetTaskRunner type
  - CharacterModelSheetStoryRecord interface extending AgentWorkflowStoryRecord
- [ ] Create `agent-backend/src/character-model-sheet/errors.ts` with CharacterModelSheetTaskError class

## Milestone 2: Prompt Builder

- [ ] Create `agent-backend/src/character-model-sheet/promptBuilder.ts`
- [ ] Implement `extractGlobalAesthetic(visualDesignDocument): object` function
- [ ] Implement `extractCharacterDesign(visualDesignDocument, characterId): object` function
- [ ] Implement `buildModelSheetPrompt(globalAesthetic, characterDesign): string` function
  - **IMPORTANT**: Use EXACT template from `docs/018_visual_reference_image_structured_prompt_plan.md` - DO NOT modify or reinvent
  - Base template MUST start with: "Character model sheet, character design sheet, concept art for animation, professional production art."
  - MUST include "A 3-row grid layout."
  - MUST include exact Top row specification with T-pose and orthographic views
  - MUST include exact Middle row specification with four expressions
  - MUST include exact Bottom row specification with four action poses
  - MUST include exact Style, Lighting & Background, and Constraint sections
  - Append JSON block with global_aesthetic and character_design objects (no comments in actual output)
- [ ] Write unit tests for promptBuilder (`test/characterModelSheetPromptBuilder.test.ts`)
  - Test extraction of global_aesthetic from visual design document
  - Test extraction of character_design by character_id
  - Test complete prompt assembly matches exact template from plan document
  - Test error handling for missing character_id
  - Test JSON serialization correctness (no comments in JSON output)

## Milestone 3: Task Runner Core Logic

- [ ] Create `agent-backend/src/character-model-sheet/characterModelSheetTask.ts`
- [ ] Implement `runCharacterModelSheetTask(storyId, dependencies): Promise<CharacterModelSheetTaskResult>` function
- [ ] Implement story validation:
  - Throw error if story not found
  - Throw error if visual_design_document is null/missing
  - Throw error if character_designs array is empty
- [ ] Implement character targeting logic:
  - Support batch mode (no targetCharacterId) - process all characters
  - Support single-character mode (targetCharacterId specified)
  - Throw error if targetCharacterId not found in character_designs
- [ ] Implement override flag logic:
  - Skip generation if character_model_sheet_image_path exists and override=false
  - Generate image if character_model_sheet_image_path exists and override=true
  - Always generate if character_model_sheet_image_path is null/undefined
- [ ] Implement resume flag logic:
  - In batch mode with resume=true, skip characters with existing paths
  - Ignore or warn if resume=true in single-character mode

## Milestone 4: Image Generation Integration

- [ ] Implement GeminiImageClient resolution (reuse from dependencies or create default)
- [ ] Implement ImageStorageService resolution (reuse from dependencies or create default)
- [ ] Implement verbose logging support:
  - Accept verbose flag in task dependencies
  - When verbose=true: log complete assembled prompt before Gemini call
  - When verbose=true: log request parameters (aspectRatio, timeout, retry)
  - When verbose=true: log generation start/completion timestamps
  - DO NOT log binary image data (log only metadata like size in bytes)
  - Log saved file path after successful storage
- [ ] Implement per-character generation loop:
  - Build structured prompt using promptBuilder
  - Log prompt if verbose=true
  - Call geminiClient.generateImage() with aspectRatio='1:1'
  - Log request params if verbose=true
  - Construct image path: `<story-id>/visuals/characters/<character-id>/character-model-sheet.png`
  - Save image using imageStorage.saveImage()
  - Log saved path if verbose=true
  - Update visual_design_document with character_model_sheet_image_path immediately
  - Catch and wrap Gemini errors with character context
  - Catch and wrap storage errors with character context
- [ ] Implement batch error handling:
  - Continue processing after individual character failures
  - Collect error list with character context
  - Return success count and error summary

## Milestone 5: Workflow Integration

- [ ] Update `agent-backend/src/workflow/types.ts`:
  - Add 'CREATE_CHARACTER_MODEL_SHEETS' to StoryWorkflowTask union type
  - Add CharacterModelSheetTaskOptions type
  - Add characterModelSheetTaskOptions?: CharacterModelSheetTaskOptions to AgentWorkflowOptions
  - Add runCharacterModelSheetTask?: CharacterModelSheetTaskRunner to AgentWorkflowOptions
- [ ] Update `agent-backend/src/workflow/storyWorkflow.ts`:
  - Import runCharacterModelSheetTask and related types
  - Add case for 'CREATE_CHARACTER_MODEL_SHEETS' in runTask() switch statement
  - Implement task runner invocation with dependencies
  - Pass through targetCharacterId, override, resume from options
  - Handle and propagate task errors

## Milestone 6: CLI Integration

- [ ] Update `agent-backend/src/cli/agentWorkflowCli.ts`:
  - Add 'CREATE_CHARACTER_MODEL_SHEETS' to SUPPORTED_TASKS array
  - Add characterId?: string to RunTaskCommandOptions interface
  - Add override?: boolean to RunTaskCommandOptions interface (for model sheets)
  - Add resume?: boolean to RunTaskCommandOptions interface (for model sheets)
  - Implement parsing for `--character-id <id>` flag
  - Implement parsing for `--override <true|false>` flag
  - Implement parsing for `--resume` flag
  - Validate that --resume is not used with --character-id (or ignore with warning)
  - Pass verbose flag from CLI to characterModelSheetTaskOptions (enable detailed logging)
  - Pass parsed options to workflow's characterModelSheetTaskOptions
- [ ] Update CLI help text with CREATE_CHARACTER_MODEL_SHEETS usage examples
- [ ] Update `agent-backend/README.md` with new task documentation and --verbose behavior

## Milestone 7: Testing

- [ ] Write unit tests for characterModelSheetTask (`test/characterModelSheetTask.test.ts`):
  - Test story validation (not found, no visual design, no characters)
  - Test batch mode (all characters)
  - Test single-character mode
  - Test character not found error
  - Test override=false skips existing images
  - Test override=true regenerates existing images
  - Test resume=true skips characters with paths in batch mode
  - Test path construction
  - Test immediate database update after each generation
  - Test Gemini error handling with character context
  - Test storage error handling without database corruption
  - Test batch continues after individual failures

BELOW OPTIONAL DO NOT IMPLEMENT:

- [ ] Write integration tests (`test/characterModelSheetIntegration.test.ts`):
  - Test end-to-end single character generation
  - Test end-to-end batch generation
  - Test filesystem persistence at correct paths
  - Test database persistence in visual_design_document
  - Test aspect ratio is 1:1 (if Gemini client is not stubbed)
  - Test --override=false skips behavior
  - Test --override=true regenerates behavior
  - Test --resume skips characters with existing sheets
- [ ] Write CLI integration tests (`test/agentWorkflowCli.test.ts`):
  - Test parsing of CREATE_CHARACTER_MODEL_SHEETS command
  - Test parsing of --character-id flag
  - Test parsing of --override flag
  - Test parsing of --resume flag
  - Test flag validation (--resume without --character-id)

## Milestone 8: Validation and Documentation

- [ ] Run `openspec validate add-character-model-sheet-task --strict` and fix all issues
- [ ] Run all unit tests and ensure 100% pass rate
- [ ] Run all integration tests and ensure 100% pass rate
- [ ] Test end-to-end in development environment:
  - Generate model sheets for a test story with multiple characters
  - Verify images are saved to correct paths
  - Verify visual_design_document is updated correctly
  - Verify --override and --resume flags work as expected
- [ ] Update `agent-backend/README.md` with:
  - Description of CREATE_CHARACTER_MODEL_SHEETS task
  - Usage examples for batch mode
  - Usage examples for single-character mode
  - Documentation of --character-id, --override, and --resume flags
- [ ] Review all created files for code quality and consistency
