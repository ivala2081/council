-- P0: Threads — lightweight continuity layer for returning founders
-- A thread groups related missions (runs) for the same idea over time.

create table threads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_token text not null,
  latest_verdict text,
  latest_score integer,
  run_count integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add thread_id to missions (nullable for backwards compat)
alter table missions add column thread_id uuid references threads(id) on delete set null;
alter table missions add column run_number integer default 1;
alter table missions add column delta jsonb;

-- Indexes
create index idx_threads_owner on threads(owner_token);
create index idx_threads_updated on threads(updated_at desc);
create index idx_missions_thread on missions(thread_id);
