## Why
- Story Tree UI cards and layouts diverge from design direction captured in `docs/026_ui_style_plan.md`
- Current story list and sidebar styles surface extra chrome (color dots, author text) and inconsistent shadows that hinder readability
- Visual tab asset cards need simplified hierarchy to foreground artwork and metadata per latest plan

## What Changes
- Refresh story list card layout to present two cards per row, remove redundant chrome, and derive the logline from the constitution "Logline" bullet
- Update story detail sidebar and tab navigation to remove nested cards, ensure full-width thumbnails, and add a subtle selection state on the tab bar
- Introduce a subtle card elevation baseline across the UI with hover emphasis in place of current heavy drop shadows
- Reshape visual tab character and environment cards so artwork spans full width, metadata stacks in a flat list, and associated scenelets render in a compact footer

## Impact
- Story Tree UI specification reflects new styling requirements ahead of implementation work
- Visual UI specification communicates the revised layout expectations for asset cards
- No backend or data model changes required

## Open Questions
- None identified; specs will guide implementation details directly.
