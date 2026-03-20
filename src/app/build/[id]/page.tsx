"use client";

import React, { use, useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhaseCheckpoint } from "@/components/phase-checkpoint";
import {
  BuildProgressBar,
  PhaseOutputCard,
  AuditEntry,
} from "@/components/build-view";
import { Separator } from "@/components/ui/separator";
import { ProjectPreview } from "@/components/sandpack-preview";

type PhaseStatus = "pending" | "running" | "awaiting_approval" | "completed" | "failed";

interface PhaseOutput {
  id: string;
  phase: number;
  agent_name: string;
  output: Record<string, unknown>;
  confidence: number | null;
  tokens_used: number | null;
  model_used: string | null;
  human_approved: boolean;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  event_type: string;
  agent_name: string;
  model_used: string;
  duration_ms: number;
  tokens_used: number;
  cost_usd: number;
  error_message?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  current_phase: number;
  complexity_class: string;
  risk_level: string;
  deploy_url?: string;
}

interface GeneratedFile {
  file_path: string;
  content: string;
  language: string;
}

interface ProjectData {
  project: Project;
  phases: PhaseOutput[];
  files: GeneratedFile[];
  auditLog: AuditLogEntry[];
  totals: { tokens: number; costUsd: number; fileCount: number };
}

const PHASE_NAMES: Record<number, string> = {
  1: "Strategy",
  2: "Product",
  3: "Architecture",
  4: "Build",
  5: "Verify",
  6: "Release",
};

// Agents per phase that need human approval
const APPROVAL_PHASES = [2, 3, 4, 5];

function getPhaseStatuses(
  data: ProjectData | null,
  currentPhase: number,
  awaitingApproval: boolean,
  building: boolean,
): { phase: number; name: string; status: PhaseStatus }[] {
  // Determine which phases have outputs
  const phasesWithOutputs = new Set(data?.phases.map((p) => p.phase) ?? []);

  return [1, 2, 3, 4, 5, 6].map((num) => {
    let status: PhaseStatus = "pending";
    if (phasesWithOutputs.has(num) && num < currentPhase) {
      status = "completed";
    } else if (num < currentPhase) {
      // Skipped phase (e.g. Phase 5)
      status = "completed";
    } else if (num === currentPhase) {
      if (awaitingApproval) status = "awaiting_approval";
      else if (data?.project.status === "failed") status = "failed";
      else if (data?.project.status === "live") status = "completed";
      else if (building) status = "running";
      else status = "pending";
    }
    return { phase: num, name: PHASE_NAMES[num], status };
  });
}

function getCheckpointSummary(phases: PhaseOutput[], phase: number): { summary: string; details: string[] } {
  const outputs = phases.filter((p) => p.phase === phase);
  if (outputs.length === 0) return { summary: `Phase ${phase} completed.`, details: [] };

  const details: string[] = [];

  for (const output of outputs) {
    const label = output.agent_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (output.agent_name === "product_manager" && output.output.features) {
      const features = output.output.features as unknown[];
      details.push(`${features.length} features defined (${label})`);
    } else if (output.agent_name === "architect" && output.output.apiContracts) {
      const contracts = output.output.apiContracts as unknown[];
      details.push(`${contracts.length} API endpoints designed (${label})`);
    } else if (output.agent_name === "designer" && output.output.pages) {
      const pages = output.output.pages as unknown[];
      details.push(`${pages.length} page components designed (${label})`);
    } else if (output.agent_name === "security_threat" && output.output.attackSurface) {
      const threats = output.output.attackSurface as unknown[];
      details.push(`${threats.length} threat vectors analyzed (${label})`);
    } else if (output.agent_name === "legal" && output.output.riskFlags) {
      const flags = output.output.riskFlags as unknown[];
      details.push(`${flags.length} legal risk flags identified (${label})`);
    } else {
      details.push(`${label} completed`);
    }
  }

  return {
    summary: `Phase ${phase} (${PHASE_NAMES[phase]}) ready for review.`,
    details,
  };
}

export default function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) {
      setError("Project not found");
      return;
    }
    const json = await res.json();
    setData(json);

    // If project is paused (awaiting approval), reflect that
    if (json.project.status === "paused" || json.project.status === "awaiting_approval") {
      setAwaitingApproval(true);
    }
    // If project is actively building, start polling
    const activeStatuses = ["product", "design", "building", "verifying", "releasing"];
    if (activeStatuses.includes(json.project.status)) {
      setBuilding(true);
    }
  }, [id]);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);

      const { project: p, phases: ph } = json;
      const status = p.status as string;

      // Build log from audit entries
      const recentAgents = (json.auditLog ?? [])
        .slice(0, 5)
        .reverse()
        .map((a: { event_type: string; agent_name: string }) =>
          `Phase ${p.current_phase}: ${a.event_type} — ${a.agent_name?.replace(/_/g, " ")}`,
        );
      if (recentAgents.length > 0) setStreamLog(recentAgents);

      // Terminal states
      if (status === "paused") {
        setAwaitingApproval(true);
        setBuilding(false);
        stopPolling();
      } else if (status === "live") {
        setBuilding(false);
        stopPolling();
      } else if (status === "failed") {
        setError("Build failed — check audit log for details");
        setBuilding(false);
        stopPolling();
      }
    }, 3000);
  }, [id, stopPolling]);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Initial load + auto-start polling if build is in progress
  useEffect(() => {
    fetchProject()
      .then(() => {
        // Check if we need to start polling (set by fetchProject via setBuilding)
      })
      .finally(() => setLoading(false));
  }, [fetchProject]);

  // Auto-start polling when building state is set (e.g. on page reload during active build)
  useEffect(() => {
    if (building && !pollRef.current) {
      startPolling();
    }
  }, [building, startPolling]);

  const startBuild = useCallback(async () => {
    setBuilding(true);
    setStreamLog([]);
    setError(null);
    setAwaitingApproval(false);

    const res = await fetch(`/api/projects/${id}/build`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to start build");
      setBuilding(false);
      return;
    }

    // Pipeline runs in background — poll for updates
    startPolling();
  }, [id, startPolling]);

  const handleApprove = useCallback(async () => {
    if (!data) return;
    setApproving(true);
    try {
      await fetch(`/api/projects/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: data.project.current_phase, approved: true }),
      });
      setAwaitingApproval(false);
      await startBuild();
    } finally {
      setApproving(false);
    }
  }, [data, id, startBuild]);

  const handleChange = useCallback(async (feedback: string) => {
    if (!data) return;
    setApproving(true);
    try {
      await fetch(`/api/projects/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: data.project.current_phase, approved: false, feedback }),
      });
      setAwaitingApproval(false);
      await startBuild();
    } finally {
      setApproving(false);
    }
  }, [data, id, startBuild]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-status-error">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { project, phases, files, auditLog, totals } = data;
  const phaseStatuses = getPhaseStatuses(data, project.current_phase, awaitingApproval, building);

  const isIdle = !building && !awaitingApproval && project.status !== "live";
  const canRetry = !building && !awaitingApproval && project.status === "failed";
  const needsApproval = awaitingApproval && APPROVAL_PHASES.includes(project.current_phase);
  const { summary, details } = getCheckpointSummary(phases, project.current_phase);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/95 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-muted-foreground hover:text-foreground text-sm">← Council</a>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-sm truncate max-w-[200px]">{project.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{totals.tokens.toLocaleString()} tok</span>
            <span>·</span>
            <span>${totals.costUsd.toFixed(4)}</span>
            <span>·</span>
            <span>{totals.fileCount} files</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Progress */}
        <BuildProgressBar
          phases={phaseStatuses}
          currentPhase={project.current_phase}
          projectName={project.name}
        />

        {/* Status / Action */}
        {error && (
          <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-950/20">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </Card>
        )}

        {isIdle && project.status === "intake" && (
          <Card className="p-6 text-center space-y-3">
            <h3 className="font-semibold">Ready to build</h3>
            <p className="text-sm text-muted-foreground">
              AiCompanyOS will run all 6 phases autonomously. You'll review each phase before it continues.
            </p>
            <Button onClick={startBuild} className="w-full max-w-sm">
              Start Build Pipeline →
            </Button>
          </Card>
        )}

        {canRetry && (
          <Card className="p-6 text-center space-y-3 border-red-200 bg-red-50 dark:bg-red-950/20">
            <h3 className="font-semibold text-red-700 dark:text-red-400">Build failed</h3>
            <p className="text-sm text-muted-foreground">
              Some agents failed. You can retry — completed phases will be skipped.
            </p>
            <Button onClick={startBuild} variant="outline" className="w-full max-w-sm">
              Retry Build →
            </Button>
          </Card>
        )}

        {building && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-status-info animate-pulse">◎</span>
              <span className="text-sm font-medium">Building...</span>
            </div>
            {streamLog.length > 0 && (
              <div className="space-y-1">
                {streamLog.slice(-5).map((log, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{log}</p>
                ))}
              </div>
            )}
          </Card>
        )}

        {needsApproval && (
          <PhaseCheckpoint
            phase={project.current_phase}
            phaseName={PHASE_NAMES[project.current_phase] ?? `Phase ${project.current_phase}`}
            summary={summary}
            details={details}
            onApprove={handleApprove}
            onChange={handleChange}
            loading={approving}
          />
        )}

        {project.status === "live" && (
          <Card className="p-6 text-center space-y-3 border-green-200 bg-green-50 dark:bg-green-950/20">
            <p className="text-2xl">✓</p>
            <h3 className="font-semibold text-green-700 dark:text-green-400">Build Complete</h3>
            {project.deploy_url && (
              <a
                href={project.deploy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 underline"
              >
                {project.deploy_url}
              </a>
            )}
          </Card>
        )}

        {/* Live Preview */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Live Preview
            </h3>
            <ProjectPreview files={files} />
          </div>
        )}

        {/* Phase Outputs */}
        {phases.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Phase Outputs
            </h3>
            {phases.map((p) => (
              <PhaseOutputCard key={p.id} agentName={p.agent_name} output={p.output} />
            ))}
          </div>
        )}

        {/* Audit Log */}
        {auditLog.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider pt-2">
              Audit Log
            </h3>
            <Card className="p-3 divide-y divide-border/50">
              {auditLog.map((entry) => (
                <AuditEntry key={entry.id} event={entry} />
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
