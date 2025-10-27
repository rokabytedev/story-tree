create table if not exists public.shots (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  scenelet_id text not null,
  scenelet_sequence integer not null check (scenelet_sequence > 0),
  shot_index integer not null check (shot_index > 0),
  storyboard_payload jsonb not null,
  first_frame_prompt text not null check (char_length(trim(first_frame_prompt)) > 0),
  key_frame_prompt text not null check (char_length(trim(key_frame_prompt)) > 0),
  video_clip_prompt text not null check (char_length(trim(video_clip_prompt)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (story_id, scenelet_id, shot_index)
);

create index if not exists shots_story_scenelet_idx
  on public.shots using btree (story_id, scenelet_id, shot_index);

create trigger set_current_timestamp_updated_at_shots
before update on public.shots
for each row
execute function public.set_current_timestamp_updated_at();

alter table if exists public.stories
  drop column if exists storyboard_breakdown,
  drop column if exists generation_prompts;
