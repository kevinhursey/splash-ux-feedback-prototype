-- Run in Supabase SQL editor or via supabase db push
create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  selected_topics jsonb not null,
  selected_subtopics jsonb not null,
  comments jsonb not null,
  other_feedback text not null default '',
  can_contact boolean not null default false,
  email text,
  session_id text not null,
  source text not null,
  environment text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

-- INSERT for anonymous clients (browser + anon key)
create policy "Allow anonymous insert"
  on public.feedback_submissions
  for insert
  to anon
  with check (true);

-- Optional but recommended if you use insert().select() / RETURNING in the client:
-- PostgREST applies SELECT policies to the RETURNING row. Without this, those
-- requests can fail even though plain INSERT would succeed.
create policy "Allow anonymous select"
  on public.feedback_submissions
  for select
  to anon
  using (true);
