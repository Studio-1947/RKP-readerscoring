alter table public.reader_profiles
  add column if not exists favorite_authors text[] not null default '{}',
  add column if not exists favorite_books text[] not null default '{}';

alter table public.reader_profiles
  add constraint reader_profiles_favorite_authors_limit check (cardinality(favorite_authors) <= 4),
  add constraint reader_profiles_favorite_books_limit check (cardinality(favorite_books) <= 4);
