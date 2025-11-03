one problem is that the script writer keeps writing the story for way too long. i changed the system prompts to instruct AI to follow length constraint:
- system_prompts/create_story_constitution.md
- system_prompts/create_interactive_script.md
read them to understand how it works.

there are several changes you need to introduce to make the length limit working:
- from the output of story constitution, there will be a new field `target_scenelets_per_path`. it will be saved in the constitution json column in database. no change is needed here i think?
- when running the script writing task, in the user prompt, add the `target_scenelets_per_path` and the pre-calculated current story path scenelet length to remind AI to respect the length requirement. it can go in the `## Current Narrative Path` section at the top to state what the required length is and what the current path length is.
