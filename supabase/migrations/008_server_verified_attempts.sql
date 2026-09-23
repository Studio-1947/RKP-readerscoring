-- Scores are created only by authenticated server routes using the service-role key.
drop policy if exists "reader owns their profile" on public.reader_profiles;
create policy "reader reads their profile" on public.reader_profiles for select to authenticated using ((select auth.uid()) = id);
create policy "reader updates their profile" on public.reader_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "reader inserts own attempts" on public.reading_attempts;
drop policy if exists "reader inserts own quiz attempts" on public.quiz_attempts;
