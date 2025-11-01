# Task List: Add UUID Foreign Key to Shots Table

This document breaks down Option 1 (Add UUID Foreign Key) into detailed, executable tasks.

## Overview

Add a new `scenelet_ref` column to the `shots` table as a UUID foreign key referencing `scenelets.id`. This provides proper referential integrity while maintaining backward compatibility with existing string-based `scenelet_id` values.

**Note:** No backfill needed - we can regenerate the shots table. The critical fix is ensuring the bundle assembler correctly links shots to scenelets using UUIDs.

---

## Phase 1: Schema Migration

### Task 1.1: Create Migration File - Add scenelet_ref Column

**File:** `supabase/migrations/000008_add_shots_scenelet_ref.sql`

**Actions:**
- Create new migration file
- Add `scenelet_ref` column as NOT NULL UUID with foreign key constraint
- Add index on `scenelet_ref` for query performance
- Add ON DELETE CASCADE behavior

**SQL:**
```sql
-- Add scenelet_ref column with FK constraint
alter table public.shots
  add column scenelet_ref uuid not null references public.scenelets(id) on delete cascade;

-- Add index for query performance
create index if not exists shots_scenelet_ref_idx
  on public.shots using btree (scenelet_ref);

-- Comment explaining the column
comment on column public.shots.scenelet_ref is
  'UUID foreign key reference to scenelets.id. Links shot to its parent scenelet for efficient joins and proper referential integrity.';
```

**Validation:**
- Run migration in local Supabase
- Verify column exists and is NOT NULL
- Verify FK constraint exists
- Verify index is created
- Check cascade delete behavior

---

### Task 1.2: Apply Migration to Local Database

**Actions:**
- Run the migration using Supabase CLI
- Verify schema changes applied correctly

**Commands:**
```bash
# Reset database (will regenerate all data)
npx supabase db reset
```

**Validation:**
```sql
-- Check column exists and is NOT NULL
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'shots' and column_name = 'scenelet_ref';

-- Should show:
-- scenelet_ref | uuid | NO

-- Check FK constraint exists
select
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'shots'::regclass
  and conname = 'shots_scenelet_ref_fkey';

-- Check index exists
select indexname, indexdef
from pg_indexes
where tablename = 'shots' and indexname = 'shots_scenelet_ref_idx';
```

---

### Task 1.3: Test Cascade Delete Behavior

**Actions:**
- Create test scenelet and shots in local database
- Delete the scenelet
- Verify shots are automatically deleted
- Verify referential integrity is enforced

**Test Script:**
```sql
-- Create test story first (if needed)
insert into stories (id, display_name)
values (gen_random_uuid(), 'Test Story')
returning id;
-- Note the story ID

-- Create test scenelet
insert into scenelets (id, story_id, content, is_branch_point, is_terminal_node)
values (
  gen_random_uuid(),
  '<test-story-id>',
  '{"description": "Test scenelet"}'::jsonb,
  false,
  false
)
returning id;
-- Note the returned UUID

-- Create test shot
insert into shots (
  story_id,
  scenelet_ref,
  scenelet_id,
  scenelet_sequence,
  shot_index,
  storyboard_payload
)
values (
  '<test-story-id>',
  '<scenelet-uuid-from-above>',
  'test-scenelet-1',
  1,
  1,
  '{}'::jsonb
)
returning id;

-- Verify shot exists
select count(*) from shots where scenelet_ref = '<scenelet-uuid>';
-- Should return 1

-- Delete scenelet
delete from scenelets where id = '<scenelet-uuid>';

-- Verify shot was cascade deleted
select count(*) from shots where scenelet_ref = '<scenelet-uuid>';
-- Should return 0
```

---

## Phase 2: Update Repository Layer

### Task 2.1: Add Type Definitions

**File:** Check where shot types are defined - likely in `agent-backend/src/shot-production/types.ts` or `supabase/src/shotsRepository.ts`

**Actions:**
- Find existing `ShotRecord` or similar interface
- Add `scenelet_ref` field as required string (UUID)
- Update insert/update types
- Ensure type safety across the codebase

**Code:**
```typescript
export interface ShotRecord {
  id: string;
  story_id: string;
  scenelet_ref: string;              // NEW - UUID reference
  scenelet_id: string;               // Keep existing - "scenelet-1" style
  scenelet_sequence: number;
  shot_index: number;
  storyboard_payload: StoryboardPayload;
  key_frame_image_path: string | null;
  audio_file_path: string | null;
  created_at: string;
  updated_at: string;
}
```

---

### Task 2.2: Update createSceneletShots Method

**File:** `supabase/src/shotsRepository.ts`

**Actions:**
- Update `createSceneletShots` to accept `sceneletRef` parameter
- Populate `scenelet_ref` when creating shots
- Keep existing `scenelet_id` parameter for backward compatibility
- Update method signature and documentation

**Current Signature:**
```typescript
async createSceneletShots(
  storyId: string,
  sceneletId: string,      // "scenelet-1" style string
  sceneletSequence: number,
  shotInputs: CreateShotInput[]
): Promise<void>
```

**New Signature:**
```typescript
async createSceneletShots(
  storyId: string,
  sceneletRef: string,     // NEW: UUID reference
  sceneletId: string,      // Keep: "scenelet-1" style string
  sceneletSequence: number,
  shotInputs: CreateShotInput[]
): Promise<void>
```

**Implementation:**
```typescript
const shotRecords = shotInputs.map((input) => ({
  story_id: trimmedStoryId,
  scenelet_ref: sceneletRef,         // NEW
  scenelet_id: sceneletId,
  scenelet_sequence: sceneletSequence,
  shot_index: input.shotIndex,
  storyboard_payload: input.storyboardPayload,
}));

const { error } = await client
  .from(SHOTS_TABLE)
  .insert(shotRecords);
```

---

### Task 2.3: Add Query Method by Scenelet UUID

**File:** `supabase/src/shotsRepository.ts`

**Actions:**
- Add new method `getShotsBySceneletRef(sceneletRef: string)`
- Query shots using the UUID reference
- Order by `shot_index`
- Add documentation

**New Method:**
```typescript
/**
 * Get all shots for a specific scenelet using UUID reference.
 */
async getShotsBySceneletRef(
  sceneletRef: string
): Promise<ShotRecord[]> {
  const trimmedRef = sceneletRef.trim();

  const { data, error } = await client
    .from(SHOTS_TABLE)
    .select()
    .eq('scenelet_ref', trimmedRef)
    .order('shot_index', { ascending: true });

  if (error) {
    throw new Error(
      `Failed to get shots for scenelet ${trimmedRef}: ${error.message}`
    );
  }

  return data ?? [];
}
```

---

### Task 2.4: Update getShotsByStory to Return UUID-Keyed Map

**File:** `supabase/src/shotsRepository.ts`

**Actions:**
- Update `getShotsByStory` to return shots grouped by `scenelet_ref` (UUID) instead of `scenelet_id` (string)
- This is CRITICAL for bundle assembler to work correctly
- Update return type documentation

**Current Implementation:**
```typescript
async getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>> {
  // ... query shots ...

  // Groups by scenelet_id (string like "scenelet-1")
  const grouped: Record<string, ShotRecord[]> = {};
  for (const shot of sorted) {
    const key = shot.scenelet_id;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(shot);
  }
  return grouped;
}
```

**Updated Implementation:**
```typescript
/**
 * Get all shots for a story, grouped by scenelet UUID reference.
 * Returns a map of scenelet_ref (UUID) -> array of shots for that scenelet.
 */
async getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>> {
  const trimmedStoryId = storyId.trim();

  const { data, error } = await client
    .from(SHOTS_TABLE)
    .select()
    .eq('story_id', trimmedStoryId)
    .order('scenelet_sequence', { ascending: true })
    .order('shot_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to get shots for story ${trimmedStoryId}: ${error.message}`);
  }

  const sorted = [...(data ?? [])].sort((a, b) => {
    if (a.scenelet_sequence !== b.scenelet_sequence) {
      return a.scenelet_sequence - b.scenelet_sequence;
    }
    if (a.shot_index !== b.shot_index) {
      return a.shot_index - b.shot_index;
    }
    return 0;
  });

  // Group by scenelet_ref (UUID) instead of scenelet_id (string)
  const grouped: Record<string, ShotRecord[]> = {};
  for (const shot of sorted) {
    const key = shot.scenelet_ref;  // CHANGED: Use UUID instead of string ID
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(shot);
  }

  return grouped;
}
```

**Why This is Critical:**
- The bundle assembler (line 76-80 in `bundleAssembler.ts`) checks if `rootScenelet.id` exists in the manifest
- `rootScenelet.id` is a UUID
- The manifest is built from the result of `getShotsByStory`
- Therefore, `getShotsByStory` MUST return UUID-keyed map, not string-keyed map

---

### Task 2.5: Update Repository Interface and Exports

**File:** `supabase/src/shotsRepository.ts`

**Actions:**
- Update repository interface to include new methods
- Export new types
- Update factory function
- Add JSDoc documentation

**Interface:**
```typescript
export interface ShotsRepository {
  createSceneletShots(
    storyId: string,
    sceneletRef: string,      // UPDATED: Added parameter
    sceneletId: string,
    sceneletSequence: number,
    shotInputs: CreateShotInput[]
  ): Promise<void>;

  /**
   * Get all shots for a story, grouped by scenelet UUID (scenelet_ref).
   * Keys are UUIDs, not the "scenelet-N" string IDs.
   */
  getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>>;

  getShotsBySceneletRef(sceneletRef: string): Promise<ShotRecord[]>;  // NEW

  // ... existing methods
}
```

---

## Phase 3: Update Application Code

### Task 3.1: Investigate sceneletEntry Structure in Shot Production

**File:** `agent-backend/src/shot-production/shotProductionTask.ts`

**Actions:**
- Read the file to understand where `sceneletsInOrder` comes from
- Identify what data is available in each `sceneletEntry`
- Determine if we have access to both the UUID and the string ID
- Document the data structure

**Investigation Points:**
- Check `StoryTreeSnapshot` type definition
- Check where `sceneletsInOrder` is populated
- Verify UUID is available in scenelet entries
- Check if `assembleStoryTreeSnapshot` provides the necessary data

---

### Task 3.2: Update Shot Production Task

**File:** `agent-backend/src/shot-production/shotProductionTask.ts`

**Actions:**
- Update `createSceneletShots` calls to pass `sceneletRef` parameter
- Extract UUID from scenelet entry
- Pass both UUID and string ID
- Add comments explaining the dual-ID system

**Current Code (approximate location ~133-229):**
```typescript
for (const [index, sceneletEntry] of sceneletsInOrder.entries()) {
  const scenelet = sceneletEntry.data;
  const sceneletSequence = index + 1;

  // ... generate shots ...

  await shotsRepository.createSceneletShots(
    trimmedStoryId,
    scenelet.id,           // "scenelet-N" string
    sceneletSequence,
    shotInputs
  );
}
```

**Updated Code:**
```typescript
for (const [index, sceneletEntry] of sceneletsInOrder.entries()) {
  const scenelet = sceneletEntry.data;
  const sceneletSequence = index + 1;

  // Extract the UUID from the scenelet entry
  // sceneletEntry should have both:
  // - sceneletEntry.id: The UUID from the database
  // - scenelet.id: The computed string ID like "scenelet-1"
  const sceneletUuid = sceneletEntry.id;  // UUID
  const sceneletStringId = scenelet.id;   // "scenelet-N" string

  // ... generate shots ...

  await shotsRepository.createSceneletShots(
    trimmedStoryId,
    sceneletUuid,          // NEW: UUID reference for FK
    sceneletStringId,      // KEEP: String ID for ordering/display
    sceneletSequence,      // Numeric ordering
    shotInputs
  );
}
```

**Note:** The exact field names may vary - Task 3.1 will clarify the structure.

---

### Task 3.3: Fix Bundle Assembler Asset Path Generation

**File:** `agent-backend/src/bundle/bundleAssembler.ts`

**Actions:**
- Review `buildManifestFromShotMap` function (line 231)
- Verify it now receives UUID-keyed map from `getShotsByStory`
- Update `buildImageRelativePath` and `buildAudioRelativePath` calls to use UUIDs
- Ensure manifest keys are UUIDs for correct lookup

**Current Code (line 231-268):**
```typescript
export function buildManifestFromShotMap(
  shotsByScenelet: Record<string, ShotRecord[]>,
  logger?: BundleLogger
): AssetManifest {
  const manifest: AssetManifest = new Map();

  for (const [sceneletId, shots] of Object.entries(shotsByScenelet)) {
    // sceneletId is now a UUID (from scenelet_ref), not "scenelet-1" string

    const shotMap: SceneletShotAssetMap = new Map();

    for (const shot of shots) {
      const hasImage = Boolean(shot.keyFrameImagePath?.trim?.());
      const hasAudio = Boolean(shot.audioFilePath?.trim?.());

      if (!hasImage && !hasAudio) {
        continue;
      }

      const assetPaths: ShotAssetPaths = {
        // Use sceneletId (now a UUID) for asset paths
        imagePath: hasImage ? buildImageRelativePath(sceneletId, shot.shotIndex) : null,
        audioPath: hasAudio ? buildAudioRelativePath(sceneletId, shot.shotIndex) : null,
      };

      shotMap.set(shot.shotIndex, assetPaths);
    }

    if (shotMap.size > 0) {
      manifest.set(sceneletId, shotMap);  // Key is now UUID
    } else {
      logger?.warn?.('Scenelet skipped due to missing assets', { sceneletId });
    }
  }

  return manifest;
}
```

**Verification:**
- After this change, `manifest.keys()` at line 76 will contain UUIDs
- `availableSceneletIds.has(rootScenelet.id)` at line 77 will work because both are UUIDs
- The error "Root scenelet X does not have playable assets" should be fixed

---

### Task 3.4: Verify Bundle Assembly Flow End-to-End

**File:** `agent-backend/src/bundle/bundleAssembler.ts`

**Actions:**
- Trace through the entire `assembleBundleJson` function
- Verify all UUID references are consistent
- Check that `buildShotNodes` function handles UUIDs correctly
- Ensure `SceneletNode.id` uses UUID (line 108)

**Key Points to Verify:**
```typescript
// Line 69: shotsByScenelet is now UUID-keyed
const shotsByScenelet = await shotsRepository.getShotsByStory(normalizedId);

// Line 70: manifest is built with UUID keys
const manifest = buildManifestFromShotMap(shotsByScenelet, logger);

// Line 76: availableSceneletIds contains UUIDs
const availableSceneletIds = new Set(manifest.keys());

// Line 77: Check root scenelet UUID exists in manifest
if (!availableSceneletIds.has(rootScenelet.id)) {  // Both are UUIDs now
  throw new BundleAssemblyError(...);
}

// Line 93: Lookup using UUID
const assetsForScenelet = manifest.get(scenelet.id);  // scenelet.id is UUID

// Line 108: SceneletNode.id is UUID
nodes.push({
  id: scenelet.id,  // UUID, not string ID
  description,
  shots,
  next,
});
```

---

### Task 3.5: Update Asset Path Helper Functions

**File:** Find where `buildImageRelativePath` and `buildAudioRelativePath` are defined

**Actions:**
- Locate the helper functions
- Verify they accept UUID as `sceneletId` parameter
- Update JSDoc comments to clarify they expect UUID
- Ensure generated paths use UUID (e.g., `assets/shots/{uuid}/1_key_frame.png`)

**Expected Implementation:**
```typescript
/**
 * Build relative path for shot image asset.
 * @param sceneletId - UUID of the scenelet (not the string ID like "scenelet-1")
 * @param shotIndex - Shot index within the scenelet
 */
export function buildImageRelativePath(sceneletId: string, shotIndex: number): string {
  return `assets/shots/${sceneletId}/${shotIndex}_key_frame.png`;
  // Example: "assets/shots/a1b2c3d4-.../1_key_frame.png"
}

/**
 * Build relative path for shot audio asset.
 * @param sceneletId - UUID of the scenelet (not the string ID like "scenelet-1")
 * @param shotIndex - Shot index within the scenelet
 */
export function buildAudioRelativePath(sceneletId: string, shotIndex: number): string {
  return `assets/shots/${sceneletId}/${shotIndex}_audio.wav`;
  // Example: "assets/shots/a1b2c3d4-.../1_audio.wav"
}
```

---

### Task 3.6: Add Integration Tests

**File:** Create or update test file for bundle assembler

**Actions:**
- Add test for creating shots with `scenelet_ref`
- Verify `scenelet_ref` is populated correctly
- Test bundle assembly with UUID-based shots
- Test that root scenelet check passes
- Test cascade delete behavior

**Test Cases:**
```typescript
describe('Bundle Assembly with scenelet_ref', () => {
  it('should assemble bundle using UUID-based shot lookup', async () => {
    // Create test story and scenelets
    const story = await createTestStory();
    const rootScenelet = await createTestScenelet(story.id, null);
    const childScenelet = await createTestScenelet(story.id, rootScenelet.id);

    // Create shots using UUID references
    await shotsRepository.createSceneletShots(
      story.id,
      rootScenelet.id,  // UUID
      'scenelet-1',
      1,
      [testShotInput]
    );

    // Assemble bundle
    const result = await assembleBundleJson(story.id, dependencies);

    // Verify bundle uses UUIDs
    expect(result.bundle.rootSceneletId).toBe(rootScenelet.id);
    expect(result.bundle.scenelets[0].id).toBe(rootScenelet.id);

    // Verify asset manifest uses UUIDs
    expect(result.assetManifest.has(rootScenelet.id)).toBe(true);
  });

  it('should not throw "Root scenelet does not have playable assets" error', async () => {
    // This was the original bug - manifest was keyed by string IDs,
    // but lookup was by UUID
    const story = await createTestStory();
    const rootScenelet = await createTestScenelet(story.id, null);

    await shotsRepository.createSceneletShots(
      story.id,
      rootScenelet.id,
      'scenelet-1',
      1,
      [testShotInput]
    );

    // Should NOT throw
    await expect(
      assembleBundleJson(story.id, dependencies)
    ).resolves.not.toThrow();
  });

  it('should cascade delete shots when scenelet is deleted', async () => {
    const story = await createTestStory();
    const scenelet = await createTestScenelet(story.id, null);

    await shotsRepository.createSceneletShots(
      story.id,
      scenelet.id,
      'scenelet-1',
      1,
      [testShotInput]
    );

    // Verify shots exist
    const shotsBefore = await shotsRepository.getShotsBySceneletRef(scenelet.id);
    expect(shotsBefore.length).toBeGreaterThan(0);

    // Delete scenelet
    await sceneletsRepository.deleteScenelet(scenelet.id);

    // Verify shots are deleted
    const shotsAfter = await shotsRepository.getShotsBySceneletRef(scenelet.id);
    expect(shotsAfter).toHaveLength(0);
  });
});
```

---

## Phase 4: Documentation

### Task 4.1: Update Database Documentation

**File:** Create or update `docs/database-schema.md`

**Actions:**
- Document the `scenelet_ref` column purpose
- Explain the dual-ID system (UUID vs string)
- Document when to use `scenelet_ref` vs `scenelet_id`
- Document the cascade delete behavior
- Explain why both IDs are needed

**Content:**
```markdown
## Shots Table - Scenelet Relationship

The `shots` table has a dual-identifier system for relating to scenelets:

### 1. scenelet_ref (UUID, Foreign Key)
- Foreign key to `scenelets.id`
- Use for database joins and referential integrity
- Enables cascade delete behavior
- Used by bundle assembler to link shots to scenelets

### 2. scenelet_id (TEXT)
- Human-readable identifier like "scenelet-1", "scenelet-2"
- Computed via depth-first tree traversal
- Use for ordering and display purposes
- Appears in story tree YAML

### 3. scenelet_sequence (INTEGER)
- Explicit numeric ordering (1, 2, 3, ...)
- Use as primary sort key for playback order
- Duplicates the number in `scenelet_id` but provides indexed ordering

## Why Two IDs?

- **Database layer**: Uses UUIDs (`scenelet_ref`) for referential integrity
- **Story tree layer**: Uses sequential strings (`scenelet_id`) for readability
- **Mapping**: String IDs are computed at runtime, not persisted in scenelets table

## Critical for Bundle Assembly

The bundle assembler requires `scenelet_ref` to correctly link shots to scenelets:
- `getShotsByStory()` returns shots grouped by UUID (scenelet_ref)
- Manifest is keyed by UUID
- Root scenelet lookup uses UUID
- Asset paths use UUID as directory name

**Before fix:** Shots grouped by "scenelet-1" string → manifest lookup by UUID failed
**After fix:** Shots grouped by UUID → manifest lookup by UUID succeeds

## Usage Guidelines

**Creating shots:**
```typescript
await shotsRepository.createSceneletShots(
  storyId,
  sceneletUuid,      // UUID for FK relationship
  "scenelet-1",      // String for display/ordering
  1,                 // Sequence number
  shotInputs
);
```

**Querying shots:**
```typescript
// Get all shots for a story (UUID-keyed)
const shotsByScenelet = await shotsRepository.getShotsByStory(storyId);
// Returns: { "uuid-123": [...], "uuid-456": [...] }

// Get shots for specific scenelet by UUID
const shots = await shotsRepository.getShotsBySceneletRef(sceneletUuid);
```
```

---

### Task 4.2: Add Code Comments

**Files:**
- `supabase/src/shotsRepository.ts`
- `agent-backend/src/shot-production/shotProductionTask.ts`
- `agent-backend/src/bundle/bundleAssembler.ts`

**Actions:**
- Add JSDoc comments explaining the dual-ID system
- Document why both IDs are needed
- Add comments at critical points (e.g., where getShotsByStory groups by UUID)
- Update existing comments that may be outdated

**Example Comments:**
```typescript
/**
 * Get all shots for a story, grouped by scenelet UUID.
 *
 * IMPORTANT: This method groups shots by `scenelet_ref` (UUID), NOT by
 * `scenelet_id` (string like "scenelet-1"). This is critical for the
 * bundle assembler, which needs to match shots to scenelets using their
 * UUID identifiers.
 *
 * @param storyId - Story UUID
 * @returns Map of scenelet UUID -> array of shots
 */
async getShotsByStory(storyId: string): Promise<Record<string, ShotRecord[]>>
```

---

### Task 4.3: Update OpenSpec Documentation

**File:** `openspec/specs/story-storage/spec.md` or related specs

**Actions:**
- Update spec to reflect new schema
- Document the `scenelet_ref` column
- Update any diagrams or examples
- Document the bundle assembly fix

---

## Phase 5: Testing & Validation

### Task 5.1: Manual Testing - Create Story End-to-End

**Actions:**
- Create a new story from scratch
- Generate scenelets
- Run shot production
- Verify `scenelet_ref` is populated in database
- Assemble bundle
- Verify bundle assembly succeeds without "Root scenelet does not have playable assets" error

**Validation Queries:**
```sql
-- Check shots have scenelet_ref populated
select id, scenelet_ref, scenelet_id, scenelet_sequence, shot_index
from shots
where story_id = '<test-story-id>'
limit 10;

-- Verify FK relationship
select
  s.id as shot_id,
  s.scenelet_ref,
  s.scenelet_id,
  sc.id as scenelet_uuid_from_join
from shots s
join scenelets sc on s.scenelet_ref = sc.id
where s.story_id = '<test-story-id>'
limit 10;

-- Verify root scenelet has shots
select count(*) as shot_count
from shots
where story_id = '<test-story-id>'
  and scenelet_ref = (
    select id from scenelets
    where story_id = '<test-story-id>'
      and parent_id is null
  );
-- Should be > 0 for bundle assembly to work
```

---

### Task 5.2: Test Bundle Assembly

**Actions:**
- Use the story created in Task 5.1
- Run bundle assembly
- Verify no errors
- Check bundle JSON structure
- Verify asset manifest uses UUIDs
- Verify scenelet nodes use UUIDs

**Test Command:**
```bash
# Assuming there's a CLI command or API endpoint for bundle assembly
# Adjust based on actual implementation
npm run bundle:assemble -- --story-id=<test-story-id>
```

**Validation:**
```typescript
// Check bundle structure
const bundle = result.bundle;
console.log('Root scenelet ID:', bundle.rootSceneletId);
// Should be a UUID

console.log('Scenelet nodes:');
bundle.scenelets.forEach(node => {
  console.log('  -', node.id, '(UUID)');
  console.log('    Shots:', node.shots.length);
});

// Check asset manifest
console.log('Asset manifest keys (should be UUIDs):');
result.assetManifest.forEach((shots, sceneletId) => {
  console.log('  -', sceneletId);
});
```

---

### Task 5.3: Test Cascade Delete

**Actions:**
- Create a test scenelet with shots
- Delete the scenelet
- Verify shots are automatically deleted

**Test Script:**
```sql
-- Find a scenelet with shots
select s.id as scenelet_id, count(*) as shot_count
from scenelets s
join shots sh on sh.scenelet_ref = s.id
group by s.id
limit 1;

-- Note the scenelet_id and shot_count

-- Delete the scenelet
delete from scenelets where id = '<scenelet-id>';

-- Verify shots are deleted
select count(*) from shots where scenelet_ref = '<scenelet-id>';
-- Should return 0
```

---

## Summary Checklist

### Phase 1: Schema Migration
- [ ] Task 1.1: Create migration file (add scenelet_ref column with FK)
- [ ] Task 1.2: Apply migration locally
- [ ] Task 1.3: Test cascade delete behavior

### Phase 2: Update Repository Layer
- [ ] Task 2.1: Add type definitions (add scenelet_ref to ShotRecord)
- [ ] Task 2.2: Update createSceneletShots method (add sceneletRef parameter)
- [ ] Task 2.3: Add query method by scenelet UUID
- [ ] Task 2.4: Update getShotsByStory to return UUID-keyed map (CRITICAL FIX)
- [ ] Task 2.5: Update repository interface and exports

### Phase 3: Update Application Code
- [ ] Task 3.1: Investigate sceneletEntry structure in shot production
- [ ] Task 3.2: Update shot production task (pass UUID to createSceneletShots)
- [ ] Task 3.3: Fix bundle assembler asset path generation
- [ ] Task 3.4: Verify bundle assembly flow end-to-end
- [ ] Task 3.5: Update asset path helper functions
- [ ] Task 3.6: Add integration tests

### Phase 4: Documentation
- [ ] Task 4.1: Update database documentation
- [ ] Task 4.2: Add code comments
- [ ] Task 4.3: Update OpenSpec documentation

### Phase 5: Testing & Validation
- [ ] Task 5.1: Manual testing - create story end-to-end
- [ ] Task 5.2: Test bundle assembly (verify fix for "Root scenelet does not have playable assets")
- [ ] Task 5.3: Test cascade delete

---

## Critical Fix Summary

**The Root Cause:**
The error "Root scenelet X does not have playable assets" occurred because:

1. `shotsRepository.getShotsByStory()` returned shots grouped by `scenelet_id` (string like "scenelet-1")
2. `buildManifestFromShotMap()` created manifest with string keys
3. `assembleBundleJson()` checked if `rootScenelet.id` (UUID) exists in manifest
4. **UUID lookup in string-keyed map = always fails**

**The Fix:**
- Add `scenelet_ref` UUID column to shots table
- Update `getShotsByStory()` to group by `scenelet_ref` (UUID) instead of `scenelet_id` (string)
- Manifest now has UUID keys
- UUID lookup in UUID-keyed map = succeeds

**Before:**
```typescript
shotsByScenelet = {
  "scenelet-1": [...],
  "scenelet-2": [...]
}
manifest.has("uuid-123") // false → ERROR
```

**After:**
```typescript
shotsByScenelet = {
  "uuid-123": [...],
  "uuid-456": [...]
}
manifest.has("uuid-123") // true → SUCCESS
```

---

## Estimated Timeline

- **Phase 1**: 1 hour (migration + testing)
- **Phase 2**: 2-3 hours (repository updates)
- **Phase 3**: 3-4 hours (application code + bundle fix)
- **Phase 4**: 1-2 hours (documentation)
- **Phase 5**: 1-2 hours (testing)

**Total**: ~8-12 hours of development + testing time

---

## Risk Assessment

### Low Risk
- Adding NOT NULL column (no existing data to migrate)
- Repository method updates (type-safe changes)
- Documentation updates

### Medium Risk
- Bundle assembler changes (critical path for player)
- Shot production task updates (need to verify data structure)

### Mitigation
- No backfill needed (can regenerate shots table)
- Type system will catch missing scenelet_ref
- Integration tests will verify bundle assembly
- Manual end-to-end testing before considering done
