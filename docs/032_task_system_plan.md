# problem
- currently the web ui is read only, it can't do things like, for e.g.
    - create new story
    - update story constitution via chatting with gemini
    - delete / rename story
    - modify any story artifacts (e.g. visual design json etc), via manually or chat with gemini

# goal
- design and implement the stack needed to make the web app ui to support these operations

# requirements
- ui layer
    - elements to support these operations
    - support slow operation in good ux some way (e.g. loading and auto update ui when finish etc)
- web service / api layer to accept web app ui request
- a backend worker layer to do slow operations (mainly gemini request)
    - the worker will actually call the corresponding task (e.g. create story constitution)
    - there are tasks that take very long but with clear progression (e.g. create interactive script). ui should update when progressing.
    - quick operations (e.g. write to supabase) don't need touch backend worker

your task
- fully understand and clarify my requirements (the "why").
- fully research and understand the current code base
    - current code base may have tech debt and not everything is "correct"
    - you should propose your design based on the "best design", not what "just works" for the current code base.
    - it's ok to change current code base stack / architecture / structure, if it's appropriate for the new design.
- propose thorough, detailed designs. the design is not only an ad-hoc for the specific things i mentioned above, it is a "foundation" that handles mutation, slow operation etc.
- research the proper framework / library to reuse. try not to "revinent wheels" as much as possible.
- don't worry about the scope being too large - we can split it into sub tasks and implement them by milestones.
- write your design proposal in docs
- let me review before any implementation.