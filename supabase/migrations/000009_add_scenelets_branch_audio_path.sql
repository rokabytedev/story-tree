alter table if exists public.scenelets
  add column if not exists branch_audio_file_path text;

