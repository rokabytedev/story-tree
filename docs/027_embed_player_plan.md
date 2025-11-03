# goal
- current player bundle only supports the independent mode - the output is single standalone html.
- now i want to support embed mode - creating the player output in the story-tree-ui nextjs app as a separate tab "Player" in the story page.

# requirements
- add the new "Player" tab (last one) in the story page.
- the "Player" UI should take the full area of the main area in the "Player" tab. don't put player ui inside a "box" or container. let the images take their full width as much as possible
- the player ui style should match the story-tree-ui nextjs app overall style theme. change the standalone app to use the same style theme as well.
- the player ui should have the same control - pause and play for now
- the player behavior and logic is the same as the standalone html player, e.g the grace period, the branching etc. it should feel just the same as the standalone html player.
- code wise, try to reuse the same standalone html code as much as possible but should follow tsx / next.js app best practices.

# storage
- different from the standalone player, there is no need to copy assets.
- the embedded player should rely on the assets in the public/generated folder. the for-player json can be pregenerated and embedded in the player html page. but if that's not a good pattern for tsx / nextjs app, it can be built differently than the standalone html based player as well. just don't copy the image/audio files.

# cli
- the same cli command CREATE_PLAYER_BUNDLE can be used to generate any data needed for the embedded and standalone player. if embedded player doesn't need any pre-generation, it's ok to not use cli at all for embedded player. you design.

your task
- carefully research current logic, code, status quo of the related code base
- expand this doc into detailed openspec docs
- implement the embedded play
