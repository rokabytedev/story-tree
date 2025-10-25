create table if not exists public.scenelets (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  parent_id uuid references public.scenelets(id) on delete cascade,
  choice_label_from_parent text,
  choice_prompt text,
  content jsonb not null,
  is_branch_point boolean not null default false,
  is_terminal_node boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists scenelets_story_id_idx
  on public.scenelets using btree (story_id);

create index if not exists scenelets_parent_id_idx
  on public.scenelets using btree (parent_id);
