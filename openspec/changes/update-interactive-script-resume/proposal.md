## Why
- Gemini calls for interactive story generation fail on transient API issues, forcing operators to restart long runs and lose progress.
- Partial scenelet graphs exist without a supported resume path; rerunning the workflow currently fails because we guard against duplicates.
- We need workflow-level resume support so existing scenelets are preserved and long jobs can finish without manual cleanup.

## What Changes
- Introduce exponential backoff retries for Gemini JSON generation with configurable policy.
- Allow the interactive script workflow task to resume and finish partial story trees using stored scenelets.
- Expose a workflow flag and CLI plumbing to trigger resume behaviour while still failing fast by default.

## Impact
- Long-running interactive script tasks become more reliable and resilient to transient Gemini outages.
- Operators can re-run the task without losing existing scenelets, reducing manual recovery work.
- Requires updates to stories/scenelets repositories in memory adapters but no Supabase schema changes.
