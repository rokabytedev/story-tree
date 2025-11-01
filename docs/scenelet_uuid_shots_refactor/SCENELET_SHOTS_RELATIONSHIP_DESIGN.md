# Design Document: Fixing Scenelet-Shots Database Relationship

## Problem Statement

The current database schema has a broken relationship between `scenelets` and `shots` tables:

- **Scenelets table**: Uses UUID primary key (`id`)
- **Shots table**: Uses TEXT field `scenelet_id` with values like "scenelet-1", "scenelet-2"
- **Issue**: No foreign key relationship - cannot link shots back to their parent scenelet
- **Impact**: Player code cannot efficiently join shots with scenelet data

### Current Schema Summary

```sql
-- Scenelets table
create table scenelets (
  id uuid primary key,                    -- UUID like "a1b2c3d4-..."
  story_id uuid references stories(id),
  parent_id uuid references scenelets(id),
  content jsonb,
  is_branch_point boolean,
  -- ... other fields
);

-- Shots table
create table shots (
  id uuid primary key,
  story_id uuid references stories(id),
  scenelet_id text,                       -- "scenelet-1", "scenelet-2", etc.
  scenelet_sequence integer,              -- 1, 2, 3, ...
  shot_index integer,
  storyboard_payload jsonb,
  key_frame_image_path text,
  audio_file_path text,
  -- ... other fields
  unique (story_id, scenelet_id, shot_index)
);
```

### How It Works Today

1. String IDs like "scenelet-1" are **computed** via depth-first tree traversal
2. Mapping (UUID → string) is generated in-memory by `storyTreeAssembler.ts`
3. Shots are created with these computed string IDs
4. `scenelet_sequence` provides numeric ordering (mirrors the string ID number)
5. No database-level relationship exists

**Why the two-ID system exists:**
- Database uses UUIDs for referential integrity and tree relationships
- Story tree YAML and player use sequential string IDs for readability and ordering
- The mapping is deterministic but computed at runtime, not persisted

### What `scenelet_sequence` Does

- Provides numeric ordering for shot playback (1, 2, 3, ...)
- Used as primary sort key when querying shots
- Ensures deterministic story progression
- Currently **duplicates** the number in `scenelet_id` (e.g., "scenelet-3" → sequence 3)

---

## Design Options

### Option 1: Add UUID Foreign Key (Recommended)

**Add a new column `scenelet_uuid` to reference the actual scenelet record.**

#### Schema Changes

```sql
-- Migration
alter table shots
  add column scenelet_uuid uuid references scenelets(id) on delete cascade;

create index shots_scenelet_uuid_idx on shots(scenelet_uuid);

-- Keep existing columns for backward compatibility:
-- - scenelet_id (text): Keep for human-readable ordering
-- - scenelet_sequence (integer): Keep as explicit ordering field
```

#### Updated Table Structure

```sql
create table shots (
  id uuid primary key,
  story_id uuid references stories(id),
  scenelet_uuid uuid references scenelets(id),    -- NEW: Actual FK relationship
  scenelet_id text,                                -- KEEP: Human-readable "scenelet-1"
  scenelet_sequence integer,                       -- KEEP: Numeric ordering (1, 2, 3)
  shot_index integer,
  -- ... rest of fields
);
```

#### Pros

- **Proper referential integrity**: Database enforces the relationship
- **Efficient joins**: Can query shots with scenelet data in one query
- **Backward compatible**: Keeps existing `scenelet_id` for readable values
- **Clear semantics**: Two distinct purposes - UUID for linking, text for ordering/display
- **Cascading deletes**: Shots automatically deleted when scenelet is removed
- **No breaking changes**: Existing code continues to work

#### Cons

- **Three overlapping fields**: `scenelet_uuid`, `scenelet_id`, and `scenelet_sequence` all relate to ordering
- **Slight redundancy**: Data is duplicated across columns
- **Migration complexity**: Need to backfill `scenelet_uuid` for existing shots

#### Migration Strategy

```typescript
// 1. Add the column (nullable initially)
await client.query(`
  alter table shots
  add column scenelet_uuid uuid references scenelets(id) on delete cascade
`);

// 2. Backfill existing data
// For each story:
//   - Load scenelets and build the story tree
//   - Generate UUID -> "scenelet-N" mapping
//   - Update shots.scenelet_uuid based on scenelet_id match

const scenelets = await loadSceneletsByStory(storyId);
const tree = assembleStoryTreeSnapshot(scenelets); // Creates UUID -> "scenelet-N" map
const reverseMap = new Map(); // "scenelet-N" -> UUID

tree.sceneletIds.forEach((stringId, uuid) => {
  reverseMap.set(stringId, uuid);
});

// Update shots
await client.query(`
  update shots
  set scenelet_uuid = $1
  where story_id = $2 and scenelet_id = $3
`, [reverseMap.get(sceneletId), storyId, sceneletId]);

// 3. Make column NOT NULL after backfill
await client.query(`alter table shots alter column scenelet_uuid set not null`);

// 4. Add index
await client.query(`create index shots_scenelet_uuid_idx on shots(scenelet_uuid)`);
```

#### Column Naming Alternatives

To reduce confusion, consider these naming schemes:

**Option 1a: Keep current names**
- `scenelet_uuid` - The actual FK
- `scenelet_id` - The human-readable string
- `scenelet_sequence` - The numeric ordering

**Option 1b: Rename for clarity**
- `scenelet_id` → `scenelet_ref` (UUID FK)
- `scenelet_display_id` → `scenelet_1` style string
- `sequence_number` → numeric ordering

**Option 1c: Minimal confusion**
- `scenelet_id` (UUID FK) - becomes the "real" ID
- `scenelet_label` (TEXT) - for "scenelet-1" style display
- `playback_order` (INTEGER) - explicit purpose

---

### Option 2: Replace Text ID with UUID

**Replace `scenelet_id` with a UUID foreign key, remove the string IDs entirely.**

#### Schema Changes

```sql
-- Migration
alter table shots
  drop column scenelet_id,
  add column scenelet_id uuid not null references scenelets(id) on delete cascade;

-- Keep scenelet_sequence for explicit ordering
```

#### Updated Table Structure

```sql
create table shots (
  id uuid primary key,
  story_id uuid references stories(id),
  scenelet_id uuid references scenelets(id),  -- NOW A UUID!
  scenelet_sequence integer not null,         -- Still needed for ordering
  shot_index integer,
  -- ... rest of fields
);
```

#### Pros

- **Clean schema**: Single source of truth for scenelet identity
- **Proper FK**: Database enforces relationship
- **Less redundancy**: One scenelet identifier instead of two
- **Simpler**: Easier to understand the data model

#### Cons

- **BREAKING CHANGE**: Existing code using string IDs will break
- **Lose human-readable IDs**: Can't easily see "scenelet-1" in queries
- **Migration complexity**: Must update all code that uses `scenelet_id`
- **Asset paths**: May need to update if they use string IDs in paths
- **Story tree YAML**: Currently uses string IDs in the YAML format

#### Code Impact Areas

Files that would need updates:
- `storyTreeAssembler.ts` - String ID generation logic
- `shotProductionTask.ts` - Shot creation logic
- `shotsRepository.ts` - All query methods
- `bundleAssembler.ts` - Asset path generation
- Story tree YAML serialization/deserialization
- Any client code consuming the API

#### Migration Strategy

```typescript
// 1. Create mapping for all existing shots
const storyIds = await getAllStoryIds();

for (const storyId of storyIds) {
  const scenelets = await loadSceneletsByStory(storyId);
  const tree = assembleStoryTreeSnapshot(scenelets);
  const reverseMap = new Map(); // "scenelet-N" -> UUID

  tree.sceneletIds.forEach((stringId, uuid) => {
    reverseMap.set(stringId, uuid);
  });

  // Update each shot with the UUID
  const shots = await getShotsByStory(storyId);
  for (const shot of shots) {
    const uuid = reverseMap.get(shot.scenelet_id);
    if (!uuid) {
      throw new Error(`Cannot map ${shot.scenelet_id} to UUID`);
    }
    await updateShotSceneletId(shot.id, uuid);
  }
}

// 2. Alter the column type
await client.query(`
  alter table shots
  alter column scenelet_id type uuid using scenelet_id::uuid
`);

// 3. Add foreign key constraint
await client.query(`
  alter table shots
  add constraint shots_scenelet_id_fkey
  foreign key (scenelet_id) references scenelets(id) on delete cascade
`);
```

---

### Option 3: Store String ID in Scenelets Table

**Add a `display_id` column to scenelets table to persist the computed string IDs.**

#### Schema Changes

```sql
-- Add display_id to scenelets
alter table scenelets
  add column display_id text unique;

create index scenelets_display_id_idx on scenelets(display_id);

-- Add FK to shots referencing the display_id
alter table shots
  add column scenelet_uuid uuid references scenelets(id) on delete cascade;

-- Keep scenelet_id as-is for now, or add FK constraint
alter table shots
  add constraint shots_scenelet_id_fkey
  foreign key (scenelet_id) references scenelets(display_id) on delete cascade;
```

#### Updated Table Structures

```sql
create table scenelets (
  id uuid primary key,
  display_id text unique,              -- NEW: "scenelet-1", "scenelet-2", etc.
  story_id uuid references stories(id),
  -- ... rest of fields
);

create table shots (
  id uuid primary key,
  story_id uuid references stories(id),
  scenelet_uuid uuid references scenelets(id),       -- NEW: UUID FK
  scenelet_id text references scenelets(display_id), -- NOW A REAL FK!
  scenelet_sequence integer,                         -- Keep for explicit ordering
  -- ... rest of fields
);
```

#### Pros

- **Single source of truth**: Display IDs stored once in scenelets
- **Both FK relationships**: UUID and string both have referential integrity
- **Human-readable**: Can still query by "scenelet-1" style IDs
- **Flexible**: Can change display ID format without migrating shots

#### Cons

- **Most complex**: Two FK columns in shots table
- **Persistence burden**: Must compute and store display IDs on scenelet creation
- **Uniqueness challenge**: Display IDs must be unique, but computed from tree order
- **Migration complexity**: Must backfill scenelets.display_id for all existing data
- **Update complexity**: If tree order changes, display_ids must be recalculated

#### When Display IDs Would Need Updates

- When a scenelet is inserted in the middle of the tree
- When tree structure is reorganized
- When scenelets are deleted (gaps in numbering)

This creates significant complexity for maintaining stable, sequential IDs.

---

### Option 4: Remove `scenelet_id` and `scenelet_sequence`

**Use only UUID foreign key, compute ordering on-the-fly from tree traversal.**

#### Schema Changes

```sql
-- Remove redundant columns
alter table shots
  drop column scenelet_id,
  drop column scenelet_sequence,
  add column scenelet_id uuid not null references scenelets(id) on delete cascade;

-- Rely on tree traversal for ordering
```

#### Updated Table Structure

```sql
create table shots (
  id uuid primary key,
  story_id uuid references stories(id),
  scenelet_id uuid references scenelets(id),  -- Only this!
  shot_index integer,
  -- ... rest of fields
);
```

#### Pros

- **Minimalist**: No redundant ordering columns
- **Truth from structure**: Ordering comes from tree traversal
- **Clean FK**: Single, clear relationship

#### Cons

- **MASSIVE BREAKING CHANGE**: Removes columns used throughout the codebase
- **Query complexity**: Must traverse tree to determine shot ordering
- **Performance**: Ordering shots requires loading the entire scenelet tree
- **No stable sort**: Cannot order shots without tree context
- **Bundle complexity**: Bundles would need to embed ordering separately

#### Query Example

```typescript
// Before: Simple query
const shots = await client
  .from('shots')
  .select()
  .eq('story_id', storyId)
  .order('scenelet_sequence')
  .order('shot_index');

// After: Requires tree traversal
const scenelets = await loadSceneletsByStory(storyId);
const tree = assembleStoryTreeSnapshot(scenelets);
const orderedSceneletIds = getDepthFirstOrder(tree); // UUID[]

const shots = await client.from('shots').select().eq('story_id', storyId);

// Sort in application code using tree order
shots.sort((a, b) => {
  const aIndex = orderedSceneletIds.indexOf(a.scenelet_id);
  const bIndex = orderedSceneletIds.indexOf(b.scenelet_id);
  if (aIndex !== bIndex) return aIndex - bIndex;
  return a.shot_index - b.shot_index;
});
```

This approach trades schema simplicity for query complexity.

---

## Comparison Matrix

| Aspect | Option 1: Add UUID FK | Option 2: Replace with UUID | Option 3: Store Display ID | Option 4: UUID Only |
|--------|----------------------|----------------------------|---------------------------|---------------------|
| **Referential Integrity** | ✅ Strong | ✅ Strong | ✅ Strong (2 FKs) | ✅ Strong |
| **Human-Readable IDs** | ✅ Yes (kept) | ❌ Lost | ✅ Yes (persisted) | ❌ No |
| **Schema Simplicity** | ⚠️ 3 related columns | ✅ Clean | ❌ Complex (2 FKs) | ✅ Very clean |
| **Breaking Changes** | ✅ None | ❌ Major | ⚠️ Minor | ❌ Major |
| **Query Performance** | ✅ Excellent | ✅ Excellent | ✅ Excellent | ⚠️ Requires tree load |
| **Migration Difficulty** | ⚠️ Moderate | ❌ High | ❌ Very High | ❌ High |
| **Ordering Stability** | ✅ Multiple sources | ✅ Explicit sequence | ✅ Multiple sources | ⚠️ Computed only |
| **Code Changes Required** | ✅ Minimal | ❌ Extensive | ⚠️ Moderate | ❌ Extensive |
| **Data Redundancy** | ⚠️ High | ✅ Low | ⚠️ Moderate | ✅ None |
| **Cascading Deletes** | ✅ Automatic | ✅ Automatic | ✅ Automatic | ✅ Automatic |

---

## Recommended Approach: Option 1 (Add UUID FK)

### Why Option 1 is Best

1. **Zero Breaking Changes**: Existing code continues to work
2. **Backward Compatible**: String IDs preserved for readability
3. **Database Integrity**: Proper FK relationship enforced
4. **Incremental Migration**: Can be rolled out gradually
5. **Flexible**: Keeps options open for future refactoring

### Recommended Column Naming

Use **Option 1c** (minimal confusion):

```sql
alter table shots
  add column scenelet_ref uuid references scenelets(id) on delete cascade;

-- Keep:
-- scenelet_id (text): "scenelet-1" for display/ordering
-- scenelet_sequence (integer): Explicit numeric ordering
```

**Rationale:**
- `scenelet_ref` clearly indicates "reference to another table"
- Avoids collision with existing `scenelet_id`
- Doesn't require renaming existing columns
- Clear purpose: use `scenelet_ref` for joins, `scenelet_id` for ordering/display

Alternative if you prefer clarity over compatibility:

```sql
-- Rename scenelet_id to scenelet_label (text)
-- Add scenelet_id as the UUID FK

-- This makes "scenelet_id" the "real" ID (UUID)
-- But requires updating all existing code references
```

### Implementation Plan

#### Phase 1: Schema Migration

```sql
-- Step 1: Add nullable column
alter table shots
  add column scenelet_ref uuid;

-- Step 2: Add index (before backfill for performance)
create index shots_scenelet_ref_idx on shots(scenelet_ref);

-- Step 3: Add FK constraint (after backfill)
alter table shots
  add constraint shots_scenelet_ref_fkey
  foreign key (scenelet_ref) references scenelets(id) on delete cascade;
```

#### Phase 2: Data Backfill

```typescript
import { assembleStoryTreeSnapshot } from './storyTreeAssembler';
import { listSceneletsByStory } from './sceneletsRepository';
import { getShotsByStory, updateShotSceneletRef } from './shotsRepository';

async function backfillSceneletRefs(): Promise<void> {
  const allStoryIds = await getAllStoryIds();

  for (const storyId of allStoryIds) {
    console.log(`Processing story ${storyId}...`);

    // 1. Load scenelets and build tree
    const scenelets = await listSceneletsByStory(storyId);
    if (scenelets.length === 0) continue;

    const tree = assembleStoryTreeSnapshot(scenelets);

    // 2. Build reverse mapping: "scenelet-N" -> UUID
    const stringToUuid = new Map<string, string>();
    tree.sceneletIds.forEach((stringId, uuid) => {
      stringToUuid.set(stringId, uuid);
    });

    // 3. Update all shots for this story
    const shots = await getShotsByStory(storyId);

    for (const [sceneletId, shotList] of Object.entries(shots)) {
      const uuid = stringToUuid.get(sceneletId);

      if (!uuid) {
        console.error(`Cannot map ${sceneletId} to UUID in story ${storyId}`);
        continue;
      }

      // Update all shots for this scenelet
      for (const shot of shotList) {
        await updateShotSceneletRef(shot.id, uuid);
      }
    }

    console.log(`Completed story ${storyId}`);
  }
}
```

#### Phase 3: Add NOT NULL Constraint

```sql
-- After backfill is complete and verified
alter table shots
  alter column scenelet_ref set not null;
```

#### Phase 4: Update Application Code

Add helper methods to repositories:

```typescript
// shotsRepository.ts

/**
 * Get shots for a scenelet by UUID reference
 */
async getShotsBySceneletRef(
  sceneletRef: string
): Promise<ShotRecord[]> {
  const { data, error } = await client
    .from(SHOTS_TABLE)
    .select()
    .eq('scenelet_ref', sceneletRef)
    .order('shot_index', { ascending: true });

  if (error) throw new Error(`Failed to get shots: ${error.message}`);
  return data ?? [];
}

/**
 * Get shots with joined scenelet data
 */
async getShotsWithScenelets(
  storyId: string
): Promise<ShotWithScenelet[]> {
  const { data, error } = await client
    .from(SHOTS_TABLE)
    .select(`
      *,
      scenelet:scenelet_ref (
        id,
        content,
        is_branch_point,
        choice_prompt
      )
    `)
    .eq('story_id', storyId)
    .order('scenelet_sequence', { ascending: true })
    .order('shot_index', { ascending: true });

  if (error) throw new Error(`Failed to get shots with scenelets: ${error.message}`);
  return data ?? [];
}
```

#### Phase 5: Update Player/Bundle Code

```typescript
// bundleAssembler.ts

// Before: Manual matching required
const shotsByScenelet = await shotsRepository.getShotsByStory(storyId);
const scenelets = await sceneletsRepository.listSceneletsByStory(storyId);
// ... complex matching logic ...

// After: Use joined query
const shotsWithScenelets = await shotsRepository.getShotsWithScenelets(storyId);

// Build bundle directly
for (const shot of shotsWithScenelets) {
  const scenelet = shot.scenelet; // Already joined!
  // ... build bundle node ...
}
```

---

## Alternative: Option 2 (If Starting Fresh)

If this were a greenfield project, **Option 2** (Replace with UUID) would be ideal:

- Clean schema with single source of truth
- Proper relational design
- No redundant columns

However, given the existing codebase and data, the migration cost is too high.

---

## Decision Points for User

### Question 1: Column Naming

Which naming scheme do you prefer for Option 1?

**A) Add new column, keep existing names**
- `scenelet_ref` (UUID FK) - NEW
- `scenelet_id` (TEXT) - keep as-is
- `scenelet_sequence` (INTEGER) - keep as-is

**B) Rename for clarity**
- `scenelet_id` (UUID FK) - rename existing column to `scenelet_label`, use this name for FK
- `scenelet_label` (TEXT) - was `scenelet_id`
- `playback_order` (INTEGER) - was `scenelet_sequence`

**C) Minimal change**
- `scenelet_uuid` (UUID FK) - NEW
- `scenelet_id` (TEXT) - keep as-is
- `scenelet_sequence` (INTEGER) - keep as-is

### Question 2: Should we remove `scenelet_sequence`?

The `scenelet_sequence` column currently duplicates information from `scenelet_id`:
- `scenelet_id = "scenelet-3"` → `scenelet_sequence = 3`

**Option A: Keep it**
- Pros: Explicit numeric ordering, easier to query
- Cons: Redundant data

**Option B: Remove it**
- Pros: Less redundancy
- Cons: Must parse number from string ID for ordering

**Recommendation:** Keep it for now. It provides a clear, indexed ordering field and simplifies queries. Can be removed in a future optimization if needed.

### Question 3: Should we also fix the YAML format?

The story tree YAML currently uses string IDs (`scenelet-1`). Should we:

**A) Keep string IDs in YAML** (human-readable)
- YAML continues to use "scenelet-1" style
- Mapping layer converts to UUIDs

**B) Switch to UUIDs in YAML** (consistent with DB)
- YAML uses UUID values
- Less human-readable, but no conversion needed

**Recommendation:** Keep string IDs in YAML for readability. The mapping layer already handles this conversion.

---

## Summary

**Recommended Solution: Option 1 (Add UUID Foreign Key)**

- Add `scenelet_ref` column (or `scenelet_uuid`) as UUID FK to `scenelets.id`
- Keep `scenelet_id` (TEXT) for human-readable ordering
- Keep `scenelet_sequence` (INTEGER) for explicit numeric ordering
- Backfill existing data using story tree assembly logic
- Update code to use joined queries where beneficial
- Zero breaking changes, full backward compatibility

This provides a clear migration path with minimal risk and maximum flexibility for future optimizations.
