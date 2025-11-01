# Design: Standalone HTML Player

## Context

The Story Tree project generates interactive animated storybooks with branching narratives. Stories are stored in Supabase with scenelets (narrative segments), shots (visual/audio frames), and branching points. Currently, there's no way to export or play a complete story outside the Story Tree UI workspace.

This design introduces a standalone HTML player that can play exported stories offline, enabling easy sharing and distribution without backend dependencies.

## Goals / Non-Goals

### Goals
- Export complete story with metadata and assets to a self-contained folder
- Play interactive narrative with images, audio, and choice-based branching
- Support offline playback in any modern web browser
- Integrate bundle generation into existing workflow infrastructure for future API use
- Support bundling work-in-progress stories with incomplete assets for testing

### Non-Goals
- Base64-embedded media (out of scope; using file references instead)
- Progress bar or playback statistics (future iteration)
- Player customization or theming (future iteration)
- Integration with existing Story Tree UI storyboard (separate concerns)
- Video playback (static images only for now)

## Decisions

### 1. JSON Schema Design

**Decision**: Use flat array of scenelets with forward links to children, no parent references.

**Rationale**:
- Matches user preference for fast child lookups
- Simplifies player traversal logic (only need to follow links forward)
- Similar to existing story tree YAML format but shot-level instead of scenelet-level
- Avoids redundant parent references that complicate updates

**JSON Structure**:
```typescript
interface StoryBundle {
  metadata: {
    storyId: string;
    title: string;
    exportedAt: string;
  };
  rootSceneletId: string;
  scenelets: SceneletNode[];
}

interface SceneletNode {
  id: string;
  description: string;
  shots: ShotNode[];
  next: NextNode;
}

interface ShotNode {
  shotIndex: number;
  imagePath: string;        // Relative path: assets/shots/<scenelet-id>/<shot-index>_key_frame.png
  audioPath: string | null; // Relative path: assets/shots/<scenelet-id>/<shot-index>_audio.wav
}

interface NextNode {
  type: 'linear' | 'branch' | 'terminal' | 'incomplete';
  // If type === 'linear':
  sceneletId?: string;
  // If type === 'branch':
  choicePrompt?: string;
  choices?: Array<{
    label: string;
    sceneletId: string;
  }>;
  // If type === 'incomplete': no additional fields (work-in-progress story)
}
```

**Alternatives considered**:
- Nested tree structure: More intuitive but harder to serialize from DB records
- Hybrid flat + tree: Unnecessary complexity for current use case

### 2. Bundle Output Structure

**Decision**: Generate organized folder structure with separate HTML, JSON, and assets.

```
/output/stories/<story-id>/
  ├── player.html           # Standalone player (reusable across stories)
  ├── story.json            # Story metadata and structure
  └── assets/
      └── shots/
          └── <scenelet-id>/
              ├── 1_key_frame.png
              ├── 1_audio.wav
              ├── 2_key_frame.png
              ├── 2_audio.wav
              └── ...
```
Index is 1-based. Same as the current convention used in code and DB.

**Rationale**:
- Clean separation of player code, story data, and media assets
- Assets organized by scenelet for easier debugging and maintenance
- Entire folder can be zipped for sharing
- Player HTML can be reused for multiple stories by changing URL parameter

**Alternatives considered**:
- Single HTML file with embedded JSON: Less flexible, harder to update player separately
- ZIP archive generation: Added complexity without clear benefit

### 3. Player Architecture

**Decision**: Vanilla JavaScript standalone HTML page with no framework dependencies.

**Rationale**:
- Minimal file size for easy sharing
- No build process or external dependencies
- Works offline immediately without npm install
- Browser compatibility across modern browsers

**Player State Machine**:
```
┌─────────────┐
│   START     │ (Show start button)
└──────┬──────┘
       │ Click start
       ▼
┌─────────────┐
│  PLAY_SHOT  │ (Auto-play: Display image + grace period + audio + grace period)
└──────┬──────┘
       │ Shot ends
       ▼
     ┌───┴────┐
     │  type? │
     └───┬────┘
         │
    ┌────┼────────┬──────────┐
    │    │        │          │
 linear branch terminal incomplete
    │    │        │          │
    ▼    ▼        ▼          ▼
  NEXT CHOICE  RESTART     STOP
                         (no button)
```

**Shot Playback Sequence (Auto-play)**:
1. Display shot image
2. Wait 500ms "ramp-up grace period" (prevents sudden audio start)
3. Play audio (if available) - **audio duration controls pace**
4. Wait 500ms "ramp-down grace period" (smooth transition)
5. Advance to next shot or state based on scenelet.next.type

The grace periods ensure viewers aren't surprised by immediate audio and provide smooth transitions between shots.

**Player UI Layout**:
```
┌─────────────────────────────┐
│                             │
│      Image Container        │
│   (maintains aspect ratio)  │
│                             │
├─────────────────────────────┤
│   [Play/Pause]  ━━━●━━━━   │  (Controls)
└─────────────────────────────┘

Branch Choice Overlay:
┌─────────────────────────────┐
│                             │
│    Last Shot Image          │
│                             │
│  ┌───────────────────────┐  │
│  │  Choice Question?    │  │
│  ├──────────┬───────────┤  │
│  │ [Image]  │  [Image]  │  │
│  │ Option A │  Option B │  │
│  └──────────┴───────────┘  │
└─────────────────────────────┘
```

**Alternatives considered**:
- React-based player: Requires build process, larger bundle size
- Vue/Svelte: Same drawbacks as React
- Web Components: Unnecessary complexity for single-page player

### 4. Workflow Integration

**Decision**: Add `CREATE_PLAYER_BUNDLE` task to story-workflow, implement core logic in new `bundle` module.

**Module Structure**:
```
agent-backend/src/bundle/
  ├── types.ts              # StoryBundle, SceneletNode, ShotNode types
  ├── bundleAssembler.ts    # Core logic: DB → JSON transformation
  ├── assetCopier.ts        # Copy images/audio from public/generated to output
  ├── playerBundleTask.ts   # Workflow task implementation
  └── __tests__/            # Unit tests
```

**Rationale**:
- Separates bundle logic from workflow orchestration
- Core assembler can be reused for future API endpoints
- Asset copier handles file system operations independently
- Task wrapper integrates with existing workflow infrastructure

**Dependencies**:
- Requires shot production task to have run (but doesn't require all assets to be complete)
- No dependency on visual/audio design documents (uses persisted shot data)
- **Supports work-in-progress stories**: Bundle whatever assets are available, even if incomplete

**Alternatives considered**:
- Pure CLI tool: Doesn't align with future API integration requirement
- Frontend-only bundle generation: Can't access backend story data efficiently

### 5. Player Data Loading

**Decision**: Load story.json via URL parameter, with fallback for embedded mode.

**Usage**:
```html
<!-- External JSON mode (default) -->
<a href="player.html?story=story.json">Play Story</a>

<!-- Future: Embedded mode (story.json content embedded in HTML) -->
<script>
  window.STORY_DATA = { ... };
</script>
```

**Rationale**:
- Clean separation between player and story data
- Same player.html works for all stories
- Easy to test player with different story JSONs
- Future-compatible with embedded mode

**Alternatives considered**:
- Always embedded: Harder to update player separately
- Server-side API: Breaks offline requirement

### 6. Work-in-Progress Story Support

**Decision**: Bundle generation supports incomplete stories with partial assets for testing purposes.

**Incomplete Story Handling**:
- **Missing images/audio**: Only bundle shots that have at least one asset (image OR audio)
- **Incomplete tree paths**: Follow the "shortest available path" - stop bundling when a scenelet has no shots with assets
- **Non-terminal endings**: If the last bundled scenelet is not marked as terminal, the player simply stops (no restart button)
- **Partial branches**: If a branch has only one child with assets, bundle it as a linear continuation

**Rationale**:
- Enables testing player with partially generated stories during development
- Useful for iterative content creation (can test beginning while rest is being generated)
- Graceful degradation: player works with whatever content is available
- No need for "complete story" validation before bundling

**Implementation Strategy**:
```
For each scenelet in tree traversal:
  1. Get shots from DB
  2. Filter to shots with keyFrameImagePath OR audioFilePath
  3. If no shots with assets:
     - Stop including this branch
     - Don't add to scenelets array
  4. If shots available:
     - Include scenelet with available shots
     - Copy available assets (skip missing files with warning)
     - Determine next state based on available children
```

**Player Behavior for Incomplete Stories**:
- Plays available shots normally
- When reaching a non-terminal scenelet with no next state (incomplete):
  - Shows last shot image
  - Does NOT show restart button
  - Player remains paused (allows user to manually reload to replay)

**Alternatives considered**:
- Require complete stories: Too restrictive for testing workflow
- Generate placeholder assets: Unnecessary complexity, confusing for users

## Risks / Trade-offs

### Risk: Large asset files for complex stories
**Impact**: Bundle folders could be 100+ MB for stories with many shots
**Mitigation**:
- Document size expectations in user guide
- Consider asset compression in future iteration
- Use efficient PNG/WAV encoding during generation

### Risk: Browser compatibility for audio playback
**Impact**: Older browsers may not support WAV audio or autoplay policies
**Mitigation**:
- Use standard HTML5 audio element (wide compatibility)
- Handle autoplay blocks gracefully with user play button
- Document supported browsers (Chrome 80+, Firefox 75+, Safari 13+)

### Trade-off: No progress tracking in v1
**Benefit**: Simpler implementation, faster delivery
**Cost**: Users can't see "shot 5 of 50" progress
**Rationale**: User requested deferring this to future iteration

### Trade-off: No thumbnail pre-generation
**Benefit**: Simpler bundle generation, smaller output
**Cost**: Choice UI loads full images (potentially slower)
**Rationale**: Modern browsers cache images efficiently; optimization can come later if needed

## Migration Plan

N/A - This is a new capability with no existing functionality to migrate.

## Open Questions

### 1. Player HTML location
**Question**: Should player.html live in `apps/story-tree-ui/public/` or `agent-backend/src/bundle/templates/`?

**Options**:
- A) `apps/story-tree-ui/public/player/` - Makes it accessible via Next.js public folder
- B) `agent-backend/src/bundle/templates/` - Keeps bundle logic self-contained

**Recommendation**: Option B (backend templates) - Bundle task can copy template to output; keeps player separate from UI workspace

### 2. CLI command naming
**Question**: What should the CLI command be called?

**Options**:
- A) `--task CREATE_PLAYER_BUNDLE` (matches task naming convention)
- B) `export-story --story-id <id>` (more user-friendly)

**Recommendation**: Option A for workflow task, Option B as potential future CLI alias

### 3. Asset file naming
**Question**: Keep current naming (`<shot-index>_key_frame.png`) or simplify (`<shot-index>.png`)?

**Recommendation**: Keep current naming to avoid confusion when copying from `public/generated/`; can refactor later if needed
