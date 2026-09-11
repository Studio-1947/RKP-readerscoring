-- Treat a phone number as the stable participant identity. A shared browser can
-- create multiple anonymous auth users, and a returning reader may receive a new
-- auth user; grouping here keeps one best score per actual participant.
create or replace function public.practice_leaderboard()
returns table(reader_label text, best_score integer)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
           nullif(split_part(trim(max(p.full_name)), ' ', 1), ''),
           'Reader'
         ) as reader_label,
         max(a.total_score)::integer as best_score
  from public.reader_profiles p
  join public.reading_attempts a on a.reader_id = p.id
  where p.leaderboard_opt_in = true
  group by regexp_replace(p.phone, '[^0-9]', '', 'g')
  order by best_score desc, reader_label
  limit 1000;
$$;

revoke all on function public.practice_leaderboard() from public;
grant execute on function public.practice_leaderboard() to anon, authenticated;
