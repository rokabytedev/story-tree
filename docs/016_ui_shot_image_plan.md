goal:
update the storyboard ui (the story tree binary tree diagram, url `/story/<story-id>/storyboard`)
for the shots in each scenelet, use real shot image (the shot-n_key_frame.png of each shot). right now it's placholder showing shot suggestions data.

requirements:
- the images are 16:9 aspect ratio. keep it that way. don't stretch the image out of shape.
    - set a fixed height for all images.
- change the "shot suggestions" text -> "Shots"
- remove the shot description from the shot_suggestions from scenelet data. don't show any text for the shot image
- the images should form a carousel (horizontal images roll) inside the scenelet card (in the same position as now).
- show left and right arrows on the carousel to move left / right to show previous and next shot images.
- when clicking on a shot image, should show a shot detail panel on the right of the page (slide in animation or something like that)
    - the panel shows:
        - a bigger image (the key frame) of the shot at the top
        - all the detailed data of the shot
            - all columns from the db shot row
            - render the storyboard_payload as properly json formatting (the json code block should wrap ling line so user can read the long line without having to awkwardly horizontally scroll).
- make the canvas bigger by removing the card container containing the canvas box. i.e. the container with the
"Storyboard Canvas"
"Explore the narrative flow with an interactive tree of scenelets and branching points."
text at the top.

your task
- expand this doc into detailed openspec spec doc + design doc + other docs
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.