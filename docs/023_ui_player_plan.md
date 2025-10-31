# goal
- create an independent web based ui html player that can play the generated interactive storybook.
- for now, focus on static image only. playing video clip is out of scope for now but will be implemented in the future
- the player can play any input json bundle (the output format of the interactive storybook bundled in a json format file).

# data format
- create a new task to bundle the storybook into a json format that can be played with the player ui
- the json schema should be designed to handle the binary tree structure of the story tree

it should meet the following requirements:
- represent the order of the scenelets and shots so that the player knows how to play them in order
- represent the structure of the story tree
    - linear continuation
    - branching
    - terminal
- be able to identify the files (image, audio)

different modes:
- the bundle can be "lightweight mode" - only the metadata is included in the json. more suitable for online serving.
- or a deep copy mode - all the image and audio file binaries are encoded (base64 maybe?) into the json as well - making the json huge
- the most complete mode is deep copy + embed player to form an html file with the player + the deep copy bundle json so that the single html file can be used to play the whole story without network connection.
- you design the name of the modes

# task, workflow, cli
- implement this in all layers.
- cli can pass flag to choose the bundle mode, default should be the lightweight mode

# the player
- the player is a web html page that take json as input (e.g. through url param to load json from public folder), or be embedded with the json to form a single independent html file
- the player can play the story tree

requirements:
- before the first scene starts to play, show a start button to kick off the story
- order by shots (and scenelets in turn)
- auto play to the next shot, if linear continuation
- pause and show choice if branching. show the question, the choice labels
- the choice labels are clickable to select the branch
- the choice label uses the branch's first shot image as the thumbnails
- the story plays this way for every shot
    - show the shot image first, pause 0.5s (configurable) as the "ramping up grace period" 
    - start to play the shot's audio
    - after audio finishes, pause 0.5s (configurable), as the "ramping down grace period"
    - if linear continuation, go to next shot, repeat
    - if branching, show the branch selection ui
        - the branching ui is: pause at the last shot's image
        - show questions and choices as overlay, on top of the image, center aligned.
    - if terminal, show the last shot's image, offer a button (with proper icon and text) to start over
        - start over will bring the player back to its original state (with start button and paused)
- player widgets:
    - play / pause - will pause the image and audio play
    - a progress bar
        - based on the number of shots. descrete value. e.g. if total 100 shots, then 1/100, 2/100 ... as the shots play.
    - show the widgets at the bottom of the player ui. do not overlap on top of the image.
- player ui layout
    - show let the image take as much area as possbile but don't stretch the image. keep its original size and aspect ratio.
    - the player should have a nice "player box" type of ui to host the image inside it.
    - the player box should be able to let the image use its original size as much as possible - the player ui should not "waste" real estate of the screen.
    - the player box should have some sort of minimalism style
    - the player ui should feel professional yet delightful, appeal to both kids and adults and family. don't be too childish.

your task
- ask clarification questions
- carefully design the json schema and the player
- expand this doc into detailed openspec spec doc + design doc + other docs
    - don't just follow my bullet points. use your own design
    - make sure the tasks doc has checklist
    - tasks should be batched into major milestones
    - tasks do not include manual verification or integration test etc.
- let me review first
- implementation once i confirm design is ok.

  Clarification Questions

  1. Bundle Format & Distribution

  The document mentions three bundle modes ("lightweight", "deep copy", "standalone HTML"). Should I propose:
  - Option A: All three modes as distinct export capabilities with CLI flags
  (--bundle-mode=lightweight|embedded|standalone)?
  - Option B: Start with lightweight mode only and add embedded/standalone in future iterations?
  - Option C: Focus on standalone HTML mode as the primary deliverable?
A: focus on this option: it's a standalone HTML, the json only contains metadata. the image/audio binary files are copied into a accompanion folder.
e.g. after running a cli command, it generates:
`/output/stories/<story-id>/player.html` (the reuseable player page copied here)
`/output/stories/<story-id>/story.json` (the story's json metadata only)
`/output/stories/<story-id>/assets/shots/<scenelet-id>/<shot-index>_key_frame.png` (all the images)
`/output/stories/<story-id>/assets/shots/<scenelet-id>/<shot-index>_audio.png` (all the audios)
(the asset file names can be just the same as they are today. this is pretty much just copy files from the public/generated folder to a standalone folder. the json file should point to these files by relative path name. )
and then, i can zip the `/output/stories/<story-id>/` folder to share it with others and then it plays independently without having to have internet access.
let's focus on this mode first.

  2. Player Integration with Existing Story Tree UI

  The player should be "independent" but there's also story data in Supabase. Should I:
  - Option A: Create a completely separate standalone player app (apps/player/) that only consumes JSON bundles (no
  Supabase dependency)?
  - Option B: Add a player route to the existing Next.js UI (apps/story-tree-ui/) that can switch between "edit mode"
  (current storyboard) and "play mode" (the player)?
  - Option C: Create both - a player component in the UI workspace AND a standalone HTML export option?
A: it's none of the above. see my previous answer above. it's a standalone html page.

  3. JSON Schema Design for Story Tree Structure

  For representing the binary tree structure with scenelets, shots, and branches:
  - Option A: Flat array with parent references (like current DB schema)?
  {
    "scenelets": [
      { "id": "s1", "parentId": null, "shots": [...] },
      { "id": "s2", "parentId": "s1", "choiceLabel": "Option A", "shots": [...] }
    ]
  }
  - Option B: Nested tree structure (easier for player to traverse)?
  {
    "root": {
      "id": "s1",
      "shots": [...],
      "branches": [
        { "choicePrompt": "...", "choices": [
          { "label": "Option A", "scenelet": { "id": "s2", ... } }
        ]}
      ]
    }
  }
  - Option C: Hybrid approach with both flat array AND tree pointers for flexibility?
  A: option a. but the parent node should have "links" to the children nodes for fast look up. (sorta similar to the story tree YAML format. but for shots, not scenelets)
  parent references is not that helpful so don't have it.

  4. Audio/Image File Handling in Bundle

  For the "deep copy" mode that embeds media:
  - Option A: Base64 encode all images and audio directly into JSON (simple but large files)?
  - Option B: Use Data URLs for inline embedding in standalone HTML (standard for self-contained files)?
  - Option C: Create a ZIP archive format with separate media folder + JSON manifest?
  let's not worry about deep mode yet.

  5. Progress Tracking Granularity

  The doc mentions progress based on "number of shots" (1/100, 2/100). Should progress:
  - Option A: Count every shot equally regardless of branches (shot 1, 2, 3...)?
  - Option B: Only count shots in the currently active playthrough path (resets on replay)?
  - Option C: Track both total shots seen and current path position?
  A: to keep things simple, let's not worry about the progress yet. out of scope for now. will do later.

  6. Scope Boundaries

  Should this proposal include:
  - Storyboard visualization update: The current story-ui spec already has storyboard visualization. Should the player
   reuse those React components or be completely independent?
   A: don't touch the current story ui. this player is totally separate for now. will integrate later.
  - Backend bundle API: Should I add a backend task to story-workflow for bundle generation, or make it a pure
  CLI/frontend operation?
   A: should integrate it into the backend workflow. this is not a pure CLI/frontend thing. it's a task / workflow that will be called as API in the future. so keep the design separate. should have core logic to build the json metadata in "backend" so that they can be reused later to power service / api.
  - Thumbnail generation: Choice labels should show "first shot image as thumbnails" - should this be pre-generated
  during bundle creation or rendered on-demand in the player?
  A: no need to generate thumbnail. just use the image directly as thumbnail.
  the choice ui should look like:
  - middle top: the question
  - below the question: left + right - two labels clickable (above: thumbnail, below: choice text)
