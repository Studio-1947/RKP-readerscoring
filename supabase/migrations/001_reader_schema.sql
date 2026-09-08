-- Run this migration in the Supabase SQL Editor, or with the Supabase CLI.
-- Anonymous Auth users receive the authenticated role, so the policies below
-- let a reader access only rows belonging to their invisible reader session.

create table if not exists public.reader_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  age smallint not null check (age between 5 and 120),
  phone text not null check (char_length(phone) between 10 and 24),
  email text,
  place text not null check (char_length(place) between 1 and 120),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_attempts (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null references auth.users(id) on delete cascade,
  passage_id text not null,
  passage_title text not null,
  passage_sequence smallint not null,
  transcript text not null default '',
  duration_seconds integer not null check (duration_seconds >= 0 and duration_seconds <= 1800),
  accuracy smallint not null check (accuracy between 0 and 100),
  fluency smallint not null check (fluency between 0 and 100),
  completion smallint not null check (completion between 0 and 100),
  words_per_minute smallint not null check (words_per_minute between 0 and 500),
  total_score smallint not null check (total_score between 0 and 100),
  scoring_source text not null default 'browser' check (scoring_source in ('browser', 'server')),
  created_at timestamptz not null default now()
);

create index if not exists reading_attempts_reader_created_at_idx
  on public.reading_attempts (reader_id, created_at desc);

alter table public.reader_profiles enable row level security;
alter table public.reading_attempts enable row level security;

create policy "reader owns their profile"
  on public.reader_profiles for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "reader reads own attempts"
  on public.reading_attempts for select to authenticated
  using ((select auth.uid()) = reader_id);

create policy "reader inserts own attempts"
  on public.reading_attempts for insert to authenticated
  with check ((select auth.uid()) = reader_id);
