-- 005/007 regressed these security-definer functions from `set search_path = ''`
-- (002's original, safest setting) to `set search_path = public`. Every identifier
-- inside is already schema-qualified, so there's no live exploit, but pinning
-- search_path to empty is the correct hardening baseline for security-definer
-- functions and protects any future edit that adds an unqualified reference.
create or replace function public.practice_leaderboard()
returns table (reader_label text, best_score integer)
language sql
security definer
set search_path = ''
as $$
  select split_part(trim(p.full_name), ' ', 1) as reader_label,
         max(a.total_score)::integer as best_score
  from public.reader_profiles p
  join public.reading_attempts a on a.reader_id = p.id
  where p.leaderboard_opt_in = true
    and a.scoring_source = 'server'
    and a.created_at >= date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
  group by p.id, p.full_name
  order by best_score desc, reader_label asc;
$$;

create or replace function public.quiz_leaderboard()
returns table (reader_label text, best_score integer)
language sql
security definer
set search_path = ''
as $$
  select split_part(trim(p.full_name), ' ', 1) as reader_label,
         max(q.total_score)::integer as best_score
  from public.reader_profiles p
  join public.quiz_attempts q on q.reader_id = p.id
  where p.leaderboard_opt_in = true
    and q.created_at >= date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
  group by p.id, p.full_name
  order by best_score desc, reader_label asc;
$$;

create or replace function public.overall_leaderboard()
returns table (reader_label text, best_score integer)
language sql
security definer
set search_path = ''
as $$
  with passage as (
    select p.id, split_part(trim(p.full_name), ' ', 1) as reader_label,
           max(a.total_score)::integer as score
    from public.reader_profiles p
    join public.reading_attempts a on a.reader_id = p.id
    where p.leaderboard_opt_in = true
      and a.scoring_source = 'server'
      and a.created_at >= date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    group by p.id, p.full_name
  ),
  quiz as (
    select p.id, split_part(trim(p.full_name), ' ', 1) as reader_label,
           max(q.total_score)::integer as score
    from public.reader_profiles p
    join public.quiz_attempts q on q.reader_id = p.id
    where p.leaderboard_opt_in = true
      and q.created_at >= date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    group by p.id, p.full_name
  )
  select coalesce(passage.reader_label, quiz.reader_label) as reader_label,
         round((coalesce(passage.score, quiz.score) + coalesce(quiz.score, passage.score)) / 2.0)::integer as best_score
  from passage
  full outer join quiz on quiz.id = passage.id
  order by best_score desc, reader_label asc;
$$;
