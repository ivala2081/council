-- Event tracking for funnel analytics
create table events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  owner_token text,
  thread_id uuid references threads(id) on delete set null,
  mission_id uuid references missions(id) on delete set null,
  run_number integer,
  verdict text,
  score integer,
  score_delta integer,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_events_name on events(event_name);
create index idx_events_owner on events(owner_token);
create index idx_events_created on events(created_at desc);
create index idx_events_name_created on events(event_name, created_at);
