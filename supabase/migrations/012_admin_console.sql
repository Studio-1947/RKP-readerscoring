-- Admin-managed learning content and the moderation audit trail.
create table if not exists public.reader_passages (
  id text primary key,
  title text not null check (char_length(title) between 1 and 160),
  sequence integer not null default 0,
  difficulty_editorial text not null default 'Standard',
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  reference_text text not null check (char_length(reference_text) between 1 and 12000),
  word_count_whitespace integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.admin_quizzes (
  id text primary key,
  title_hi text not null, title_en text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.admin_quiz_questions (
  id text primary key,
  quiz_id text not null references public.admin_quizzes(id) on delete cascade,
  question_hi text not null, question_en text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_index smallint not null check (correct_index >= 0), position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_flags (
  id uuid primary key default gen_random_uuid(), reader_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('reading', 'quiz', 'manual')),
  reason text not null check (char_length(reason) between 1 and 500), status text not null default 'open' check (status in ('open', 'reviewed', 'cleared', 'actioned')),
  notes text, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), resolved_at timestamptz
);

create index if not exists reader_passages_status_idx on public.reader_passages(status, sequence);
create index if not exists admin_quizzes_status_idx on public.admin_quizzes(status);
create index if not exists moderation_flags_status_idx on public.moderation_flags(status, created_at desc);
alter table public.reader_passages enable row level security;
alter table public.admin_quizzes enable row level security;
alter table public.admin_quiz_questions enable row level security;
alter table public.moderation_flags enable row level security;
