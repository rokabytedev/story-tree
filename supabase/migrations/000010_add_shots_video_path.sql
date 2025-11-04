alter table if exists public.shots
  add column if not exists video_file_path text;
