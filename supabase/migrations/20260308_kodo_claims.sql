-- Migration: Create kodo_claims table
-- Tracks Kodo reimbursement claim submissions and their approval status

create table if not exists public.kodo_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  claim_id text not null,                          -- Kodo OPR ID returned from createReimbursementOPR
  amount numeric not null,
  checker_name text,
  category_name text,
  comment text,
  status text default 'pending',                   -- pending | approved | rejected | paid
  submitted_at timestamptz default now(),
  last_checked_at timestamptz,
  status_updated_at timestamptz,
  kodo_status_raw jsonb,                           -- Raw status response from Kodo API
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.kodo_claims enable row level security;

-- Users can only access their own claims
create policy "Users manage own claims"
  on public.kodo_claims
  for all
  using (auth.uid() = user_id);

-- Index for fast user lookups
create index if not exists kodo_claims_user_id_idx
  on public.kodo_claims (user_id, submitted_at desc);

-- Index for status polling (find pending claims to check)
create index if not exists kodo_claims_status_idx
  on public.kodo_claims (user_id, status)
  where status = 'pending';
