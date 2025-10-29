alter table if exists public.shots
  add column first_frame_image_path text,
  add column key_frame_image_path text;
