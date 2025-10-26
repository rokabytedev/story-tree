Create the initial version of the agent workflow orchestrator. Its eventual goal is to orchestrate the entire workflow from end to end to generate all the artifacts and the final outcome of the interactive story.

For now, the workflow supports several main steps (not compelte workflow yet, more in the future):
- Initialize the story by creating a new row in the database
- Take user's initial prompt which is a brief of the story's high level idea, e.g. "Create a story about a little cute Monkey going to the space and along side the adventure, teaches kids of the age 8-10 years old knowledge about the space and the universe."
(there is a db schema change needed to add a new column to the `stories` table to save the user's initial prompt). Save the user's initial prompt in DB (which can happen in the same transaction as the first step).
- Invoke the story constitution creation process with the user's initial prompt and make sure to stroe the generated story constitution into DB with the given story id.
- With the story constitution in place, invoke the interactive script writing process.
(there is a db schema change needed to remove the `interactive_script` column from `stories` table. it's ok to do breaking schema change because no real data yet because the data is stored in a separate table already).

**Test Driven Development** is MUST for this workflow. "Shell code" and business logic code must be separated for testability and good code maintainability and quality. The business logic code must be able to be tested independently from the real IO (i.e. testable without connecting to real supabase, gemini api).