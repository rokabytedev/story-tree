Goal is to handle the audio design task.

Read fully the system_prompts/audio_director.md file to understand the requirements.

The inputs:
- story constitution
- interactive script (the story tree snapshot YAML)
- visual design document
These all come from the preivous tasks' outcome which are persisted in supabase.
This task needs to fetch those to assemble the user prompt for Gemini API.
Gemini API system prompt is system_prompts/audio_director.md (whole as is don't change anything).

The output:
The audio_design_document JSON object. Parse it and validate it (mainly the `character_name` needs to match what's in the visual design document)

Follow conventions of other tasks.
Handle it in all layers:
- repository
- workflow
- cli
- tests (e.g. stub test fixtures)
- etc

Your task:
- Read and understand this doc for the intention.
- Expand this doc properly.
- Follow openspec process to propose the spec docs, implementation etc.
