# Agent Backend

This workspace houses tooling for agentic story workflows. The code is written in TypeScript and executed with the root tooling (Vitest, tsx).

## Environment

You can provide environment variables either by exporting them in your shell (`export GEMINI_API_KEY=...`) or by creating a `.env` file in the repository root (or under `agent-backend/`). The CLI automatically loads `.env` if present before invoking Gemini.

1. Copy `.env.example` to `.env` and replace the placeholder values.
2. Alternatively, export the variables directly in your terminal session before running the CLI.

Required variables:

- `GEMINI_API_KEY` – required for live Gemini invocations. Supply a Vertex or Gemini Developer key before running code that hits the live service.

Optional overrides:

- `GEMINI_MODEL` – change the model identifier without code changes.
- `GEMINI_TIMEOUT_MS` – customise the long-running request timeout (milliseconds).
- `GEMINI_THINKING_BUDGET_TOKENS` – override the thinking budget tokens.

## Development

- `npm run test` – execute the unit tests.
- `npm run typecheck` – run the TypeScript compiler in no-emit mode.
- `npm run story-constitution:cli -- --brief "A curious engineer builds a music garden"` – exercise the story constitution workflow against the live Gemini API.
- Append `--stub` to the CLI command to use the offline stubbed response when you do not want to call Gemini.

## Reference Images for Shot Generation

The `CREATE_SHOT_IMAGES` task automatically uses reference images from the visual reference package to ensure visual consistency across shots. Reference images are selected based on the `referenced_designs` field in each shot's storyboard entry.

### File Path Patterns

Reference images must follow these path conventions:

- **Character model sheets:** `apps/story-tree-ui/public/generated/<story-id>/visuals/characters/<character-id>/character-model-sheet-1.png`
- **Environment keyframes:** `apps/story-tree-ui/public/generated/<story-id>/visuals/environments/<environment-id>/keyframe_1.png`

These files are automatically created by the `CREATE_VISUAL_REFERENCE_IMAGES` task.

### How It Works

1. The Shot Production task generates shots with `referenced_designs` field containing character and environment IDs
2. The Shot Image Generation task reads this field and recommends up to 5 reference images:
   - Character model sheets are prioritized
   - Environment keyframes are included if space permits
3. Reference images are uploaded to Gemini alongside the shot generation prompt
4. Use `--verbose` flag to see which reference images are used for each shot

### Troubleshooting Missing Reference Images

If shot image generation fails with "reference image not found" errors:

1. **Verify visual reference package exists:**
   ```bash
   # Check if CREATE_VISUAL_REFERENCE task completed
   run-task --task CREATE_VISUAL_REFERENCE --story-id <story-id> --mode stub
   ```

2. **Generate reference images:**
   ```bash
   # Run CREATE_VISUAL_REFERENCE_IMAGES to create character and environment images
   run-task --task CREATE_VISUAL_REFERENCE_IMAGES --story-id <story-id> --mode real
   ```

3. **Check file paths:**
   - Character model sheets must be named exactly `character-model-sheet-1.png`
   - Environment keyframes must be named exactly `keyframe_1.png`
   - File paths are case-sensitive
   - Only PNG and JPEG formats are supported

4. **Verify referenced_designs in shots:**
   - Run Shot Production with `--verbose` to see which designs are referenced
   - Ensure character IDs and environment IDs match those in the visual reference package

5. **Use verbose mode for debugging:**
   ```bash
   # See exactly which reference images are loaded for each shot
   run-task --task CREATE_SHOT_IMAGES --story-id <story-id> --verbose --mode real
   ```

### Backward Compatibility

Shots generated before this feature was implemented may not have the `referenced_designs` field. In these cases, the system falls back to extracting character names from the storyboard payload and loading character references only.
