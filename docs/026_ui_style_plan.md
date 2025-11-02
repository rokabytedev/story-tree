# goal
improve story-tree-ui app style.

# overall style
- the card shadown is way too strong. make the shadow effect very very subtle, almost feel flat. make it a little bit highlighted when hover over.

# story list page
- the story card in the grid is too narrow. make card wider. make it 2 cards per row.
- remove the color dot on the top right corner of the card
- remove "By story tree agent" and "open explorer"
- fix the "logline not available error". it should be just the bullet point of the "Logline" section (usually the second section). extract it from the constitution markdown.

# story page side panel
- the thumbnail and story title section should NOT be in its card. just flat in the side panel.
    - keep the thumbnail image aspect ratio by only fixing its width to take the full width (with proper margin) of the side panel
    - put the story title below the thumbnail.
- the nav tab bar items should not have the card style. keep them flat.
    - selected tab should have subtle highlighted effect to indicate it's selected.

# visual tab
- for Characters / Environments card, change the layout:
    - model sheet image take the full width of the card, only fix wdith so to keep the image aspect ratio
    - next line: character id / environment id and type (character / environment)
    - metadata, each per line (e.g. role, Attire, Physique ...). don't make metadata card style. just flat.
    - put the associated scenelet ids at the bottom and very small font, very condensed format.