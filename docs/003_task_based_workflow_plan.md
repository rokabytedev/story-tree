Right now, the runAgentWorkflow only supports run the whole workflow end to end. but in some cases, the complete workflow is too complicated / lengthy to be run as a whole.

Now change the workflow to support task-based workflow.

Create a new story workflow:
- Take user brief prompt as input
    - ERROR if user brief prompt is missing / empty
- Create a new story entry in DB (pretty much placeholder)
- Return the newly created story workflow object (which holds the DB story ID)

A story workflow object can be initialized with existing story ID as well:
- Take story ID as input
- Fetch the story from DB
    - ERROR if story ID doesn't exist in DB
- The workflow object should be as stateless as possible
    - The only value it holds is the story ID
    - It should always rely on the DB as the source of truth
    - The workflow's design purpose is to just "perform the tasks"

And then can invoke the following tasks on the workflow:
- Task-1: Create story constitution
    - Invoke the story constitution creation task
    - Save the story constitution generated into DB
- Task-2: Create interactive script
    - Fetch the story constitution from DB
        - ERROR if the "Create story constitution" has not completed yet (story constitution column is not set yet)
    - Invoke the interactive script creation task
        - Use story constitution as the input for this task
    - Save the interactive script (iteratively) into DB
- More tasks will be added later

The workflow supports running one task at a time:
E.g. `workflow.runTask(CREATE_STORY_CONSTITUTION)`, `workflow.runTask(CREATE_INTERACTIVE_SCRIPT)`
- If a task has been called before, calling it again will report error (to keep it simple for now)

The current monolithic workflow can be refactored:
- It is like a `workflow.runEverything()`
- The steps should be split into tasks
- Each task should encapsulate the related logic
- `runEverything()` function will be pretty much just `runTask(CREATE_STORY_CONSTITUTION)`, `workflow.runTask(CREATE_INTERACTIVE_SCRIPT)` sequentially
- Export the individual `runTask()` function

The agent workflow CLI is a bit too complicated right now it looks. Simplify it:
- Only support two modes:
    - Stub mode: Use real supabase (local or remote. local by default). Use stub gemini responses.
    - Real mode: Use real supabase and gemini
    - (remove the stub DB mode related code. DB will always be real)
- Support running individual tasks

TDD is still key principle here.