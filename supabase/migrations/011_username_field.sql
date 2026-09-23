alter table public.reader_profiles
  add column if not exists username text;
