-- Council MVP Schema

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  preferred_language text default 'en',
  created_at timestamptz default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  industry text,
  stage text,
  description text,
  context jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table missions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  prompt text not null,
  pipeline_mode text default 'single',
  status text default 'pending',
  result jsonb,
  model_costs jsonb default '{}',
  total_cost_usd numeric(10,6) default 0,
  error text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table agent_outputs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  agent_name text not null,
  step_order integer not null,
  input_summary text,
  output jsonb not null,
  model text not null,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10,6),
  duration_ms integer,
  created_at timestamptz default now()
);

create table key_findings (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  content text not null,
  section text not null,
  source_agent text not null,
  finding_type text default 'insight',
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references missions(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  overall_score integer check (overall_score between 1 and 5),
  specificity_score integer check (specificity_score between 1 and 5),
  actionability_score integer check (actionability_score between 1 and 5),
  depth_score integer check (depth_score between 1 and 5),
  accuracy_score integer check (accuracy_score between 1 and 5),
  decision_clarity_score integer check (decision_clarity_score between 1 and 5),
  free_text text,
  would_pay boolean,
  would_use_again boolean,
  created_at timestamptz default now()
);

-- Indexes
create index idx_missions_company on missions(company_id);
create index idx_missions_status on missions(status);
create index idx_agent_outputs_mission on agent_outputs(mission_id);
create index idx_key_findings_company on key_findings(company_id);
create index idx_key_findings_mission on key_findings(mission_id);
