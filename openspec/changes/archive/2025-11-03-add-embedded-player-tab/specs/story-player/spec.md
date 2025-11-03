## ADDED Requirements
### Requirement: Provide Shared Player Runtime Module
The player MUST expose a reusable runtime controller so multiple surfaces can provide the same playback behavior.

#### Scenario: Runtime preserves playback timing and branching rules
- **GIVEN** the runtime controller is initialised with a story bundle produced by `assembleBundleJson`
- **WHEN** the consumer calls `start()`, `pause()`, `resume()`, selects branches, or restarts the story
- **THEN** the controller MUST emit state updates that honour the existing grace period timings, pause-on-branch behavior, and terminal restart flow defined in this specification
- **AND** the controller MUST reject bundles that fail validation with descriptive errors identical to the standalone HTML experience

#### Scenario: Standalone player template consumes the runtime module
- **GIVEN** `CREATE_PLAYER_BUNDLE` copies the standalone HTML template
- **WHEN** the resulting `player.html` executes
- **THEN** it MUST load the shared runtime module (via an ES module build) to drive playback instead of duplicating logic inline
- **AND** the template MUST continue to function offline with the same keyboard/mouse interactions already described in this specification

#### Scenario: Embedded React player consumes the runtime module
- **GIVEN** the Next.js Player tab renders on the client
- **WHEN** the React components mount
- **THEN** they MUST instantiate the shared runtime controller with the server-provided bundle
- **AND** they MUST subscribe to its state updates to control images, audio, and branching overlays so behaviour stays identical to the standalone player

### Requirement: Align Player Visual Theme
The embedded and standalone players MUST share Story Tree UI theming primitives.

#### Scenario: Runtime surfaces theme tokens to both surfaces
- **GIVEN** the player runtime initialises
- **WHEN** it requests UI styles (e.g., background, text, button accents)
- **THEN** it MUST read from a shared token map derived from the Story Tree design system variables (light/dark)
- **AND** both the standalone template and embedded React view MUST apply those tokens to containers, buttons, overlays, and typography so visual appearance matches the Story Tree UI
- **AND** updating the design tokens in the Next.js theme MUST propagate to the standalone player without manual restyling
