goal:
- bootstrap nextjs, reactjs, tailwindcss etc modern web app stack
- create the web app project under its own separate folder. DO NOT create under root directory
- create ui skeleton for the web app ("Story Tree")
    - define a centralized "theme" (font, color palette, etc) that will be used across the app
    - basic navigation (url based)
    - basic pages setup

the web app is a single page app with a tab based navigation
- tab bar on the most left of the page takes full height of the page
- placeholder tabs for now: "Constitution", "Script", "Storyboard", "Visual", "Audio". all with proper icon and text.
- the main area is the "canvas". it shows different type of content for different tab.
    - Constitution tab: the story constitution markdown text (ok to be raw text for now)
    - Script tab: the story tree snapshot YAML text (ok to be raw text for now)
    - Storyboard tab: leave it empty for now. will render a binary tree diagram later
    - Visual tab: the json content for the visual design and the visual reference package (ok to be raw json text for now)
    - Audio tab: the json content for the audio design (ok to be raw json text for now)

the web app routing should follow url based rule like the following (just my initial thoughts. you design the final scheme):
- https://domain.com/story/story-id-xxx/constitution -> constitution tab
- https://domain.com/story/story-id-xxx/storyboard -> storyboard tab
- https://domain.com/story -> the index page of list of stories and new story button etc
navigation should feel like it's single page app instead of full page refresh, if it's possible and follows next.js app convention. low priority if it's a lot of work to implement.

your task:
- read this doc and understand my intent
- expand this doc to be a full requirement doc (let me review before continue)
- split the scope into manageable milestone
- kick off openspec process for the spec documentations (let me review before continue)
- start the implementation of the first milestone
- let me review before continue with more milestones
