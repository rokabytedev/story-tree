1. Update the story constitution generator to expose `targetSceneletsPerPath` in the parsed result.
   - [x] Extend parsing and typing to include the new integer field with sensible defaults.
   - [x] Add unit coverage for defaulting to 12 and honoring explicit user length requests.
2. Propagate the constitution target length through storage and repository models.
   - [x] Ensure the Supabase mapper persists and returns the target length alongside existing constitution fields.
   - [x] Backfill repository tests (or add new ones) that assert the field survives a round trip.
3. Reinforce interactive script prompt construction with explicit length guidance.
   - [x] Amend the Gemini request builder to insert the target and current path length in the `## Current Narrative Path` heading.
   - [x] Introduce tests that calculate the current path scenelet count and verify the prompt output.
