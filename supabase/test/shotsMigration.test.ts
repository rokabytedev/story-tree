import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('shots migration', () => {
  it('creates the shots table and drops storyboard-era columns', async () => {
    const migration = await readFile(
      new URL('../migrations/000004_create_shots_table.sql', import.meta.url),
      'utf8'
    );

    expect(migration).toContain('create table if not exists public.shots');
    expect(migration).toContain('id uuid primary key default gen_random_uuid()');
    expect(migration).toContain('story_id uuid not null references public.stories(id) on delete cascade');
    expect(migration).toContain('scenelet_id text not null');
    expect(migration).toContain('scenelet_sequence integer not null');
    expect(migration).toContain('shot_index integer not null');
    expect(migration).toContain('storyboard_payload jsonb not null');
    expect(migration).toContain('first_frame_prompt text not null');
    expect(migration).toContain('key_frame_prompt text not null');
    expect(migration).toContain('video_clip_prompt text not null');
    expect(migration).toContain('created_at timestamptz not null default timezone(\'utc\', now())');
    expect(migration).toContain('updated_at timestamptz not null default timezone(\'utc\', now())');
    expect(migration).toContain('unique (story_id, scenelet_id, shot_index)');
    expect(migration).toContain('create index if not exists shots_story_scenelet_idx');
    expect(migration).toContain('create trigger set_current_timestamp_updated_at_shots');
    expect(migration).toContain('drop column if exists storyboard_breakdown');
    expect(migration).toContain('drop column if exists generation_prompts');
  });
});
