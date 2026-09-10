-- Switch the public leaderboard projection from an anonymized hash label to
-- the reader's first name. Requested explicitly by the product owner in place
-- of the "Reader <hash>" label from 002_practice_leaderboard.sql. Still only
-- exposes first name + best score through this security definer function --
-- phone, email, age, place, and full surname stay behind reader_profiles RLS.
create or replace function public.practice_leaderboard()
returns table(reader_label text, best_score integer)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Reader'),
         max(a.total_score)::integer
  from public.reader_profiles p
  join public.reading_attempts a on a.reader_id = p.id
  where p.leaderboard_opt_in = true
  group by p.id, p.full_name
  order by max(a.total_score) desc, p.id
  limit 10;
$$;
revoke all on function public.practice_leaderboard() from public;
grant execute on function public.practice_leaderboard() to anon, authenticated;
