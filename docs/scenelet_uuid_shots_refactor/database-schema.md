# Shots Table – Scenelet Relationship

The `public.shots` table stores generated storyboard frames and audio for each scenelet. It now uses a dual identifier system so the persistence layer can maintain referential integrity while the storytelling layer keeps human-readable ids.

## Column Overview

### `scenelet_ref` (UUID, Foreign Key)
- References `public.scenelets(id)`
- Populated with the scenelet's UUID when shots are created
- Used for joins and lookup queries inside repositories
- Enforces `ON DELETE CASCADE` so deleting a scenelet cleans up its shots automatically

### `scenelet_id` (TEXT)
- Stores the sequenced label (`scenelet-1`, `scenelet-2`, …) generated during story tree assembly
- Kept for readability and ordering in tooling, YAML exports, and logs
- Used by legacy flows that expect the deterministic string id

### `scenelet_sequence` (INTEGER)
- Numeric ordering for playback (`1, 2, 3, …`)
- Mirrors the numeric suffix in `scenelet_id` but remains as an indexed column for efficient sorting

## Why Two Identifiers?

- **Database layer** – relies on the UUID (`scenelet_ref`) to guarantee referential integrity and efficient joins.
- **Story tree layer** – presents string ids (`scenelet-#`) for deterministic ordering and human readable artifacts (YAML, prompts, logs).
- The mapping between UUID and string id is rebuilt any time the story tree is assembled, so both columns must be persisted on each shot.

## Repository Expectations

```typescript
await shotsRepository.createSceneletShots(
  storyId,
  sceneletUuid,   // scenelet_ref: UUID foreign key
  'scenelet-1',   // scenelet_id: human readable label
  1,              // scenelet_sequence
  shotInputs
);

// Grouped by UUID for bundle assembly and asset export
const shotsByScenelet = await shotsRepository.getShotsByStory(storyId);
// => { 'uuid-1234': [ShotRecord, …], 'uuid-5678': […] }

// Fetch shots for a single scenelet via UUID
const shots = await shotsRepository.getShotsBySceneletRef(sceneletUuid);
```

## Bundle Assembly Impact

The bundle assembler now expects manifests keyed by `scenelet_ref`. Using the UUID:
- Aligns manifest keys with `SceneletRecord.id`
- Allows the root scenelet check to succeed (`rootScenelet.id` is already a UUID)
- Produces asset paths like `assets/shots/<scenelet_ref>/<shot>_key_frame.png`, avoiding collisions when string labels are regenerated.

### Before the change
- Shots were grouped by `scenelet_id` (e.g., `scenelet-1`)
- Bundle assembly looked up assets by UUID, so the manifest check failed and raised: *“Root scenelet … does not have playable assets.”*

### After the change
- Shots are grouped by `scenelet_ref` (UUID)
- Manifest keys and scenelet ids match, so bundle assembly can locate assets correctly.
