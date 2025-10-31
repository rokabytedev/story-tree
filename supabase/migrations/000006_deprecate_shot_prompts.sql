alter table if exists public.shots
  drop column if exists first_frame_prompt,
  drop column if exists key_frame_prompt,
  drop column if exists video_clip_prompt,
  drop column if exists first_frame_image_path;
