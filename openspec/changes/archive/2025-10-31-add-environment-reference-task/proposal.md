# Proposal: Add Environment Reference Image Generation Task

## Overview

This change introduces a dedicated workflow task for generating environment reference images using structured prompts that solve the style drift issue observed in previous visual reference generation.

## Problem

Current visual reference image generation produces environment images with inconsistent styling. The visual reference package includes environment keyframes, but they use freeform prompts without structured guidance, leading to style drift between images.

## Solution

Create a separate `CREATE_ENVIRONMENT_REFERENCE_IMAGE` task that:

1. **Generates environment reference images specifically** - Focuses on environment reference images with a highly structured prompt format
2. **Uses structured prompts** - Combines a detailed Environment Concept Artist role prompt with environment design data from the visual design document to ensure consistency
3. **Supports batch and single-environment modes** - Can generate images for all environments (default) or target specific environments
4. **Persists paths in visual design document** - Stores generated image paths in `visual_design_document.environment_designs[].environment_reference_image_path` for easy access and state tracking
5. **Maintains idempotency** - Supports `--override` flag to control regeneration behavior

## Goals

- Eliminate style drift in environment reference images through structured prompting
- Provide a specialized task for environment reference image generation that can be invoked independently
- Store reference image paths directly in the visual design document for simpler data access
- Support both batch generation (all environments) and single-environment targeting
- Enable safe regeneration through override controls and resume capabilities

## Affected Capabilities

- **story-workflow** (MODIFIED) - Add new CREATE_ENVIRONMENT_REFERENCE_IMAGE task type
- **visual-design** (MODIFIED) - Add environment_reference_image_path field to environment designs
- **environment-reference** (ADDED) - New capability for environment reference image generation logic

## Non-Goals

- Does not replace the existing CREATE_VISUAL_REFERENCE_IMAGES task
- Does not handle environment keyframes or animation frames
- Does not modify the visual reference package schema
- Does not introduce new system prompt files (uses inline structured prompt)

## Risks and Mitigations

**Risk**: Confusion between CREATE_ENVIRONMENT_REFERENCE_IMAGE and CREATE_VISUAL_REFERENCE_IMAGES tasks
**Mitigation**: Clear documentation and distinct CLI commands. Environment reference images are specifically for structured single-image environment references.

**Risk**: Data synchronization between visual_design_document and visual_reference_package
**Mitigation**: Single source of truth - environment reference image paths live only in visual_design_document. The visual reference package continues to store image_path for environment keyframes.

**Risk**: Breaking existing workflows that depend on visual reference image paths
**Mitigation**: This is a new capability - existing CREATE_VISUAL_REFERENCE_IMAGES task remains unchanged. Environment reference images are an additional workflow step.

## Success Criteria

- [ ] Can generate environment reference images for all environments in a story via CLI
- [ ] Can generate a single reference image for a specific environment via CLI
- [ ] Environment reference images use structured prompts with visual design data
- [ ] Generated image paths are persisted in visual_design_document immediately after generation
- [ ] `--override` flag controls whether to regenerate existing images
- [ ] `--resume` flag skips environments that already have reference images
- [ ] Aspect ratio is 16:9 (default) as specified in requirements
- [ ] Unit tests validate structured prompt assembly
- [ ] Integration tests verify end-to-end generation and persistence
