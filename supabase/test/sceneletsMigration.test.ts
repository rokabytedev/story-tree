import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('scenelets migration', () => {
  it('defines scenelets table with required columns and indexes', async () => {
    const migration = await readFile(
      new URL('../migrations/000002_create_scenelets_table.sql', import.meta.url)
    , 'utf8');

    expect(migration).toContain('create table if not exists public.scenelets');
    expect(migration).toContain('story_id uuid not null references public.stories');
    expect(migration).toContain('parent_id uuid references public.scenelets');
    expect(migration).toContain('choice_prompt text');
    expect(migration).toContain('content jsonb not null');
    expect(migration).toContain('is_branch_point boolean not null default false');
    expect(migration).toContain('is_terminal_node boolean not null default false');
    expect(migration).toContain('created_at timestamptz not null');
    expect(migration).toContain('scenelets_story_id_idx');
    expect(migration).toContain('scenelets_parent_id_idx');
  });
});
