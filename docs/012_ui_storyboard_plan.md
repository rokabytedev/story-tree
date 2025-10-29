the storyboard ui should render an interactive diagram so that the user can easily browse and view the information of the story tree (binary tree, each node has 1 or 2 child nodes).

the diagram features:
- displays the whole story tree as a tree structure.
- each node is a scenelet.
    - a node is shown as a card style
    - the top is the 'scenelet-n' id
    - the top also has, in a new line, the description of the scenelet (small lighter font)
    - the middle: a horizontal scrollable caroussel of the list of shots (from the shots generation step in `shots` table). 
        - for now, can just display a single static image as placeholder. we don't have image capability yet. will be next step.
    - the bottom: the dialog in the format like:
        - character a: line 1
        - character b: line 2
        - character a: line 3 ...
- a single root node (the first scenelet)
- branching point is displayed with a different shape/style to clearly indicate it's a branching point
    - branching point should display the choice prompt question (from parent node)
    - and also the choice labels (from the child nodes)
- scenelets and branching points are connected via edges.

look at files (images) under `ui_mocks` folder for inspiration and reference.

the data behind the storyboard is the story tree snapshot YAML for now. can convert YAML to json object if it's easier rendering or other data format.
later we will include data from `shots` as well but for now. just the scenelets from story tree snapshot YAML is good enough.

the interactive diagram should be on a flexible canvas. user can zoom in / out, move around, (maybe even drag and drop to reorder the nodes, but lower priority). you should definitely not reinvent the wheels here. find a proper library / framework that support this type of canvas.

your task
- research first. find the best stack for this task
- expand this doc into a requirements doc + design doc
- let me review first
- do openspec documentation and let me review again
- implementation once i confirm design is ok.