-- Quiz leaderboard: best quiz score per opted-in reader, current calendar week (Asia/Kolkata).
create or replace function public.quiz_leaderboard()
returns table (reader_label text, best_score integer)
language sql
security definer
set search_path = public
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

revoke all on function public.quiz_leaderboard() from public;
grant execute on function public.quiz_leaderboard() to anon, authenticated;

-- Overall leaderboard: average of a reader's best passage-reading score and best
-- quiz score for the current calendar week, falling back to whichever one exists.
create or replace function public.overall_leaderboard()
returns table (reader_label text, best_score integer)
language sql
security definer
set search_path = public
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

revoke all on function public.overall_leaderboard() from public;
grant execute on function public.overall_leaderboard() to anon, authenticated;
