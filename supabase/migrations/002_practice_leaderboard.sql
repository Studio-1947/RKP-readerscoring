alter table public.reader_profiles
  add column if not exists leaderboard_opt_in boolean not null default false;

-- Only this bounded, anonymous projection is public. Profile/attempt RLS stays intact.
create or replace function public.practice_leaderboard()
returns table(reader_label text, best_score integer)
language sql stable security definer
set search_path = ''
as $$
  select 'Reader ' || upper(substr(md5(p.id::text), 1, 8)),
         max(a.total_score)::integer
  from public.reader_profiles p
  join public.reading_attempts a on a.reader_id = p.id
  where p.leaderboard_opt_in = true
  group by p.id
  order by max(a.total_score) desc, p.id
  limit 10;
$$;
revoke all on function public.practice_leaderboard() from public;
grant execute on function public.practice_leaderboard() to anon, authenticated;
