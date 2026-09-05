-- Run once in the Supabase SQL Editor for this project.
-- Shared "déjà vu" match memory: CIP/EAN -> Médiciel product code.

create table if not exists match_memory (
  cip        text primary key,
  code       text not null,
  produit    text not null,
  updated_at timestamptz not null default now()
);

alter table match_memory enable row level security;

-- No per-user login in this app yet (shared pharmacy team tool) — anyone
-- with the anon key (embedded in the deployed app, not secret) can read
-- and write. Revisit if the app ever needs per-user accounts.
create policy "anon can read match_memory"
  on match_memory for select
  using (true);

create policy "anon can upsert match_memory"
  on match_memory for insert
  with check (true);

create policy "anon can update match_memory"
  on match_memory for update
  using (true);
