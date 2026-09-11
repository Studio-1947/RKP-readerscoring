-- Rank verified readers by their best score in the current calendar week.
create or replace function public.practice_leaderboard()
returns table (reader_label text, best_score integer)
language sql
security definer
set search_path = public
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

revoke all on function public.practice_leaderboard() from public;
grant execute on function public.practice_leaderboard() to anon, authenticated;
