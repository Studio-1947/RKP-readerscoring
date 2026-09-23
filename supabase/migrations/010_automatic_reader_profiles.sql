alter table public.reader_profiles
  alter column full_name drop not null,
  alter column age drop not null,
  alter column phone drop not null,
  alter column place drop not null,
  alter column consented_at set default now();
