create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null references auth.users(id) on delete cascade,
  quiz_id text not null,
  quiz_title text not null,
  correct_count smallint not null check (correct_count >= 0),
  total_questions smallint not null check (total_questions > 0),
  total_score smallint not null check (total_score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_reader_created_at_idx
  on public.quiz_attempts (reader_id, created_at desc);

alter table public.quiz_attempts enable row level security;

create policy "reader reads own quiz attempts"
  on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = reader_id);

create policy "reader inserts own quiz attempts"
  on public.quiz_attempts for insert to authenticated
  with check ((select auth.uid()) = reader_id);
