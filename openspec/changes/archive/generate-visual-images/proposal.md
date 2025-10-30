# generate-visual-images Proposal

## Problem Statement

The visual reference and shot production tasks currently generate JSON specifications containing image generation prompts, but no actual images are created. To support storyboard visualization in the UI and enable downstream video generation, the system must generate PNG/JPG images from these prompts and persist them to the filesystem with stable paths referenced in the database.

## Scope

This change introduces two new workflow tasks:

1. **CREATE_VISUAL_REFERENCE_IMAGES**: Generates character model sheets and environment keyframe images from the visual reference package
2. **CREATE_SHOT_IMAGES**: Generates storyboard images for all shots using character reference images for consistency

The change includes:

- Gemini image generation client wrapper supporting base64 image upload and download
- File system storage for generated images under `apps/story-tree-ui/public/generated/<story-id>/`
- Database schema updates to store image paths alongside generation prompts
- Workflow task orchestration with prerequisite validation and resume capability
- CLI support for running tasks individually or as part of the full pipeline

## Goals

- Enable visual storyboard presentation in the web UI
- Maintain character visual consistency across shots using reference images
- Support incremental generation with resume mode
- Provide predictable file naming for human inspection
- Integrate seamlessly with existing workflow task patterns

## Non-Goals

- Video generation from shot images (future work)
- Image editing or regeneration UI (future work)
- Cloud storage integration (local filesystem only for now)
- Serving optimizations (Next.js static serving is sufficient)

## Dependencies

- Existing workflow tasks: `CREATE_VISUAL_REFERENCE`, `CREATE_SHOT_PRODUCTION`
- Gemini 2.5 Flash Image API (`gemini-2.5-flash-image` model)
- Stories and shots repositories for path persistence
- Next.js public directory for static file serving

## Risks & Mitigations

**Risk**: Gemini image generation rate limits or failures during bulk generation
**Mitigation**: Implement retry logic with exponential backoff; support resume mode to continue from last successful image

**Risk**: Large image file storage could bloat repository or deployments
**Mitigation**: Add `.gitignore` rules for `public/generated/`; document cleanup procedures in README

**Risk**: Character name mismatches preventing reference image lookup
**Mitigation**: Fail fast with descriptive errors when character names from shots don't match visual reference package

## Alternatives Considered

**Alternative 1**: Store images in Supabase Storage
**Rejected**: Adds complexity for MVP; local filesystem is simpler for development and testing

**Alternative 2**: Generate images on-demand via API endpoint
**Rejected**: Increases latency and cost; pre-generation enables faster UI loading

**Alternative 3**: Use UUID-based filenames
**Rejected**: Sequential numbering is more human-readable and regeneration replaces old files anyway
