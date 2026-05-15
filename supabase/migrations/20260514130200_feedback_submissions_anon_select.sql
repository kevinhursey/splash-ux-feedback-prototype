-- Idempotent: safe if you already have this policy from a newer base migration.
-- Fixes clients that use `insert().select()` (INSERT … RETURNING needs SELECT RLS).
drop policy if exists "Allow anonymous select" on public.feedback_submissions;

create policy "Allow anonymous select"
  on public.feedback_submissions
  for select
  to anon
  using (true);
