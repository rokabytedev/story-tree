-- Add scenelet_ref column with FK constraint
alter table public.shots
  add column scenelet_ref uuid not null references public.scenelets(id) on delete cascade;

-- Add index for query performance
create index if not exists shots_scenelet_ref_idx
  on public.shots using btree (scenelet_ref);

-- Comment explaining the column
comment on column public.shots.scenelet_ref is
  'UUID foreign key reference to scenelets.id. Links shot to its parent scenelet for efficient joins and proper referential integrity.';
