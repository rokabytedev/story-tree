Goal is to handle the "storyboard" task.

Read system_prompts/storyboard_artist.md file to understand what this step is.

Support this task in every layer:
- repository
- workflow
- cli
- etc

the gemini api call will needs the following inputs:
- constitution (same as for the task docs/004_concept_art_and_production_design_plan.md)
- interactive script (the story tree snapshot YAML) (same as for the task docs/004_concept_art_and_production_design_plan.md).
- the visual design document
fetch, assemble the above input to form the gemini request user prompt. system prompt is from system_prompts/storyboard_artist.md (without any change. use as is)

the gemini response should be parsed, validated, and saved to db with proper column.

the workflow cli should be extended to support this new task CREATE_STORYBOARD. follow the cli convention. support both stub and real mode, local / remote db etc. Should create and use a proper gemini stub response for --stub mode. Refer to agent-backend/fixtures.
(note that the previous visual design task didn't add proper gemini stub. you can fix it along the way if you have enough capacity / context window left, but low priority).

`scenelet_id` should refer to the value used in the story tree snapshot YAML instead of the supabase db uuid.

your task:
- read this document carefully to understand the intent
- optional: if you deem useful, you can expand / polish / formalize this document
- follow openspec's process for spec docs creation, implementation, etc.
