-- Enable required extensions for UUID generation and timestamp maintenance
create extension if not exists "pgcrypto";

-- Function and trigger to keep updated_at in sync with row updates
create or replace function public.set_current_timestamp_updated_at()
returns trigger as
$$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) > 0),
  display_name_upper text generated always as (upper(display_name)) stored,
  story_constitution jsonb,
  interactive_script jsonb,
  visual_design_document jsonb,
  audio_design_document jsonb,
  visual_reference_package jsonb,
  storyboard_breakdown jsonb,
  generation_prompts jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_current_timestamp_updated_at
before update on public.stories
for each row
execute function public.set_current_timestamp_updated_at();

create index if not exists stories_display_name_upper_idx
  on public.stories using btree (display_name_upper);
