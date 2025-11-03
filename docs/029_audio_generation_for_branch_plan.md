# problem
- in story player, in the branch selection screen, right now, there is no audio to speak the question and choices
- children may not be able to read yet. speaking the question and choices is important to yound kid.

# goal
- in create shot audio task, also generate the audio file for the branching screen
- in player, play the branching audio file in the branching screen properly

# requirements
- the branch audio file should be played on the branch screen
- the 0.5s grace period also applies: show branch screen -> 0.5s -> play the branch audio file (both question and choices) -> wait forever until user makes selection
- the audio file should speak with the narrator voice and speak the following content:
    - the question text (with a questioning expression)
    - the first choice text
    - "or"
    - the second choice text
- music should continue play (and loop if finished) during waiting for user's choice

# design
- where should the generated branch audio file be saved? several options:
    - in its own folder, e.g. "branch-point-<id>" (what is the value of the id?)
    - in the parent scenelet's folder, with a name like: `apps/story-tree-ui/public/generated/<story-id>/shots/scenelet-<id>/branch_audio.wav`
- for the player assets folder structure, maybe can follow the same as the public/generated folder structure.
- in player, how to play that audio file?
    - maybe locate it and specify the branch audio file path in the player json. must be able to identify it somehow and map the coresponding branch screen.
- the audio generation prompt
    - should be the similar to the audio generation for shots. but there is no "delivery" for controlling the voice. so need to create a constant for the generation of branch audio for narrator's voice. i think it should be somewhat like "neutral", "natural", but invoking audience's curiousity etc or something like that. you can design.

your task
- carefully research current logic, code, status quo of the related code base
- fully understand my intent for this new feature request
- expand this doc into detailed openspec spec doc + design doc + other docs
    - make sure the design doc discusses all the details for implementation. can include options to let me review.
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.
