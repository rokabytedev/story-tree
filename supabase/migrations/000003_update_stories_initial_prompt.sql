alter table public.stories
  add column if not exists initial_prompt text not null default '';

update public.stories
set initial_prompt = coalesce(initial_prompt, '');

alter table public.stories
  alter column initial_prompt drop default;

alter table public.stories
  drop column if exists interactive_script;
