-- Migration: Create reimbursement_pdfs table
-- Stores metadata for uploaded/generated reimbursement PDF packages

create table if not exists public.reimbursement_pdfs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  filename text not null,
  storage_path text not null,
  file_size integer,
  page_count integer default 1,
  total_amount numeric,
  date_from date,
  date_to date,
  purpose text,
  source text default 'uploaded',  -- 'uploaded' | 'generated'
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.reimbursement_pdfs enable row level security;

-- Users can only access their own PDFs
create policy "Users manage own PDFs"
  on public.reimbursement_pdfs
  for all
  using (auth.uid() = user_id);

-- Index for fast user lookups
create index if not exists reimbursement_pdfs_user_id_idx
  on public.reimbursement_pdfs (user_id, created_at desc);
