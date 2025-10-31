# Proposal: Add Character Model Sheet Generation Task

## Overview

This change introduces a dedicated workflow task for generating character model sheet reference images using structured prompts that solve the style drift issue observed in previous visual reference generation.

## Problem

Current visual reference image generation produces character images with inconsistent styling across different reference plates. The visual reference package includes multiple types of character plates (CHARACTER_MODEL_SHEET, EXPRESSION_SHEET, etc.), but they all use freeform prompts without structured guidance, leading to style drift between images.

## Solution

Create a separate `CREATE_CHARACTER_MODEL_SHEETS` task that:

1. **Generates model sheet images specifically** - Focuses only on CHARACTER_MODEL_SHEET type plates with a highly structured prompt format
2. **Uses structured prompts** - Combines a detailed model sheet specification with character design data from the visual design document to ensure consistency
3. **Supports batch and single-character modes** - Can generate sheets for all characters (default) or target specific characters
4. **Persists paths in visual design document** - Stores generated image paths in `visual_design_document.character_designs[].character_model_sheet_image_path` for easy access and state tracking
5. **Maintains idempotency** - Supports `--override` flag to control regeneration behavior

## Goals

- Eliminate style drift in character model sheet reference images through structured prompting
- Provide a specialized task for model sheet generation that can be invoked independently
- Store model sheet paths directly in the visual design document for simpler data access
- Support both batch generation (all characters) and single-character targeting
- Enable safe regeneration through override controls and resume capabilities

## Affected Capabilities

- **story-workflow** (MODIFIED) - Add new CREATE_CHARACTER_MODEL_SHEETS task type
- **visual-design** (MODIFIED) - Add character_model_sheet_image_path field to character designs
- **character-model-sheet** (ADDED) - New capability for model sheet generation logic

## Non-Goals

- Does not replace the existing CREATE_VISUAL_REFERENCE_IMAGES task
- Does not handle other reference plate types (expressions, action poses, etc.)
- Does not modify the visual reference package schema
- Does not introduce new system prompts (uses inline structured prompt)

## Risks and Mitigations

**Risk**: Confusion between CREATE_CHARACTER_MODEL_SHEETS and CREATE_VISUAL_REFERENCE_IMAGES tasks
**Mitigation**: Clear documentation and distinct CLI commands. Model sheets are specifically for the structured CHARACTER_MODEL_SHEET plates.

**Risk**: Data synchronization between visual_design_document and visual_reference_package
**Mitigation**: Single source of truth - model sheet paths live only in visual_design_document. The visual reference package continues to store image_path for all other plate types.

**Risk**: Breaking existing workflows that depend on visual reference image paths
**Mitigation**: This is a new capability - existing CREATE_VISUAL_REFERENCE_IMAGES task remains unchanged. Model sheets are an additional workflow step.

## Success Criteria

- [ ] Can generate model sheet images for all characters in a story via CLI
- [ ] Can generate a single model sheet for a specific character via CLI
- [ ] Model sheet images use structured prompts with visual design data
- [ ] Generated image paths are persisted in visual_design_document immediately after generation
- [ ] `--override` flag controls whether to regenerate existing images
- [ ] `--resume` flag skips characters that already have model sheets
- [ ] Aspect ratio is 1:1 as specified in requirements
- [ ] Unit tests validate structured prompt assembly
- [ ] Integration tests verify end-to-end generation and persistence
