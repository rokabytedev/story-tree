# Add Shot Audio Generation

## Why
The story tree currently generates visual previews (storyboard images) for each shot but lacks audio narration and dialogue. Adding audio generation will enable "live" previews that combine voice narration with visuals to create an immersive voice storybook experience. This completes the multimodal storytelling pipeline by providing synchronized audio for each shot's narrative content.

## What Changes
- Add `audio_file_path` column to `shots` table to store generated WAV audio files
- Create new `CREATE_SHOT_AUDIO` workflow task that generates speech from shot audio narratives
- Implement audio generation using Gemini's multi-speaker TTS API (single-speaker and multi-speaker modes)
- Support three generation modes: default (fail on existing), resume (skip existing), and override (regenerate all)
- Support batch mode (all shots in a story) and single mode (one specific shot)
- Assemble prompts from shot storyboard data, character voice profiles, and narrator voice profile
- Store audio files in local filesystem at `apps/story-tree-ui/public/generated/<story-id>/shots/<scenelet-id>/<shot-index>_audio.wav`
- Add CLI commands for audio generation with `--resume` and `--override` flags
- Update audio design document schema to include `narrator_voice_profile` at top level and `voice_name` + `character_id` fields in profiles (system prompt changes handled separately)

## Impact
- Affected specs: story-storage, story-workflow
- Affected code:
  - Database: `supabase/migrations/` (new migration for audio_file_path column)
  - Repository: `supabase/src/shotsRepository.ts` (add audio path mapping)
  - New module: `agent-backend/src/shot-audio/` (audio generation task, prompt assembly, validation)
  - Workflow: `agent-backend/src/workflow/storyWorkflow.ts` (add CREATE_SHOT_AUDIO task)
  - CLI: `agent-backend/src/cli/agentWorkflowCli.ts` (add audio generation commands)
  - Storage: `apps/story-tree-ui/public/generated/` (audio file storage location)
