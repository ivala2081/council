-- AiCompanyOS: Projects, Phase Outputs, Generated Files, Audit Log
-- Migration 004: Extends Council schema for full build pipeline

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_token TEXT NOT NULL,
  thread_id UUID REFERENCES threads(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'intake',
  -- intake | product | design | building | verifying | releasing | live | paused | failed
  current_phase INTEGER NOT NULL DEFAULT 1,
  complexity_class TEXT DEFAULT 'standard',  -- simple | standard | complex | enterprise
  risk_level TEXT DEFAULT 'low',             -- low | medium | high | critical
  github_repo TEXT,
  deploy_url TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner_token);
CREATE INDEX idx_projects_status ON projects(status);

-- Phase outputs (structured JSON from each agent)
CREATE TABLE phase_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  output JSONB NOT NULL,
  output_hash TEXT NOT NULL,
  confidence FLOAT,
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  model_used TEXT,
  verification_passed BOOLEAN,
  human_approved BOOLEAN DEFAULT FALSE,
  human_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phase_outputs_project ON phase_outputs(project_id, phase);

-- Generated files (code, config, docs)
CREATE TABLE generated_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  language TEXT,
  phase INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_files_project ON generated_files(project_id);
CREATE UNIQUE INDEX idx_generated_files_path ON generated_files(project_id, file_path, version);

-- Audit log (every agent call, approval, error)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  phase INTEGER,
  agent_name TEXT,
  model_used TEXT,
  input_hash TEXT,
  output_hash TEXT,
  confidence FLOAT,
  duration_ms INTEGER,
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_project ON audit_log(project_id, created_at DESC);
CREATE INDEX idx_audit_log_type ON audit_log(event_type);

-- Updated_at trigger for projects
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();
