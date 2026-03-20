"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { status as statusTokens } from "@/lib/design-tokens";

interface PhaseInfo {
  phase: number;
  name: string;
  status: "pending" | "running" | "awaiting_approval" | "completed" | "failed";
}

const PHASE_NAMES: Record<number, string> = {
  1: "Strategy",
  2: "Product",
  3: "Architecture",
  4: "Build",
  5: "Verify",
  6: "Release",
};

function statusIcon(status: PhaseInfo["status"]): string {
  switch (status) {
    case "completed": return "●";
    case "running": return "◎";
    case "awaiting_approval": return "◉";
    case "failed": return "✕";
    default: return "○";
  }
}

function statusColor(s: PhaseInfo["status"]): string {
  switch (s) {
    case "completed": return "text-status-success";
    case "running": return "text-status-info animate-pulse";
    case "awaiting_approval": return "text-status-warning";
    case "failed": return "text-status-error";
    default: return "text-muted-foreground";
  }
}

interface BuildViewProps {
  phases: PhaseInfo[];
  currentPhase: number;
  projectName: string;
}

export function BuildProgressBar({ phases, currentPhase, projectName }: BuildViewProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{projectName}</h2>
        <Badge variant="outline" className="font-mono text-xs">
          Phase {currentPhase}/6
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6].map((num) => {
          const phase = phases.find((p) => p.phase === num);
          const status = phase?.status ?? "pending";
          return (
            <div key={num} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-lg ${statusColor(status)}`}>
                {statusIcon(status)}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight text-center">
                {PHASE_NAMES[num]}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

interface PhaseOutputCardProps {
  agentName: string;
  output: Record<string, unknown>;
}

export function PhaseOutputCard({ agentName, output }: PhaseOutputCardProps) {
  const label = agentName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const structured = renderStructuredOutput(agentName, output);

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">{label}</Badge>
      </div>
      {structured ?? (
        <pre className="text-xs text-muted-foreground overflow-auto max-h-64 bg-muted/50 rounded p-3">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </Card>
  );
}

function renderStructuredOutput(agentName: string, output: Record<string, unknown>): React.ReactNode | null {
  switch (agentName) {
    case "product_manager":
      return <ProductSpecView data={output} />;
    case "architect":
      return <TechSpecView data={output} />;
    case "designer":
      return <DesignSpecView data={output} />;
    case "legal":
      return <LegalCheckView data={output} />;
    case "security_threat":
      return <ThreatModelView data={output} />;
    default:
      return null;
  }
}

function ProductSpecView({ data }: { data: Record<string, unknown> }) {
  const features = (data.features ?? []) as Array<{ name: string; description: string; priority: string }>;
  const pages = (data.pages ?? []) as Array<{ name: string; path: string; role: string }>;
  const roles = (data.roles ?? []) as Array<{ name: string; permissions: string[] }>;

  return (
    <div className="space-y-3 text-sm">
      {features.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Features ({features.length})</p>
          <div className="space-y-1">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 mt-0.5">
                  {f.priority}
                </Badge>
                <div>
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground ml-1.5">{f.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {pages.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pages ({pages.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {pages.map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs font-mono">{p.path}</Badge>
            ))}
          </div>
        </div>
      )}
      {roles.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Roles ({roles.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{r.name}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TechSpecView({ data }: { data: Record<string, unknown> }) {
  const stack = data.stack as Record<string, string> | undefined;
  const apiContracts = (data.apiContracts ?? []) as Array<{ method: string; path: string; description: string; auth: boolean }>;
  const dbSchema = data.dbSchema as { tables?: Array<{ name: string; rls: boolean }> } | undefined;

  return (
    <div className="space-y-3 text-sm">
      {stack && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Stack</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stack).filter(([, v]) => v).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-xs">
                {k}: {v}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {apiContracts.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">API Contracts ({apiContracts.length})</p>
          <div className="space-y-1 font-mono text-xs">
            {apiContracts.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant={c.method === "GET" ? "outline" : "secondary"} className="text-[10px] px-1.5 w-14 justify-center">
                  {c.method}
                </Badge>
                <span className="text-foreground">{c.path}</span>
                {c.auth && <span className="text-status-warning text-[10px]">auth</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {dbSchema?.tables && dbSchema.tables.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Database ({dbSchema.tables.length} tables)</p>
          <div className="flex flex-wrap gap-1.5">
            {dbSchema.tables.map((t, i) => (
              <Badge key={i} variant="outline" className="text-xs font-mono">
                {t.name} {t.rls && "🔒"}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DesignSpecView({ data }: { data: Record<string, unknown> }) {
  const tokens = data.tokens as { colors?: Record<string, string> } | undefined;
  const pages = (data.pages ?? []) as Array<{ name: string; path: string }>;
  const sharedComponents = (data.sharedComponents ?? []) as Array<{ name: string }>;

  return (
    <div className="space-y-3 text-sm">
      {tokens?.colors && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Colors</p>
          <div className="flex gap-1.5">
            {Object.entries(tokens.colors).map(([name, hex]) => (
              <div key={name} className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: hex }} />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {pages.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pages ({pages.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {pages.map((p, i) => (
              <Badge key={i} variant="outline" className="text-xs">{p.name} — {p.path}</Badge>
            ))}
          </div>
        </div>
      )}
      {sharedComponents.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Components ({sharedComponents.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {sharedComponents.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-mono">{c.name}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LegalCheckView({ data }: { data: Record<string, unknown> }) {
  const riskFlags = (data.riskFlags ?? []) as string[];
  const regulations = (data.regulations ?? []) as string[];
  const recommendation = data.recommendation as string | undefined;

  return (
    <div className="space-y-3 text-sm">
      {recommendation && (
        <p className="text-foreground">{recommendation}</p>
      )}
      {regulations.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Regulations</p>
          <div className="flex flex-wrap gap-1.5">
            {regulations.map((r, i) => <Badge key={i} variant="outline" className="text-xs">{r}</Badge>)}
          </div>
        </div>
      )}
      {riskFlags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Risk Flags ({riskFlags.length})</p>
          <div className="space-y-1">
            {riskFlags.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-status-warning">
                <span>⚠</span><span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThreatModelView({ data }: { data: Record<string, unknown> }) {
  const attackSurface = (data.attackSurface ?? []) as Array<{ area: string; risk: string }>;
  const recommendations = (data.recommendations ?? []) as string[];

  return (
    <div className="space-y-3 text-sm">
      {attackSurface.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Attack Surface ({attackSurface.length})</p>
          <div className="space-y-1">
            {attackSurface.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant={a.risk === "high" ? "destructive" : a.risk === "medium" ? "secondary" : "outline"} className="text-[10px] px-1.5">
                  {a.risk}
                </Badge>
                <span>{a.area}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {recommendations.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recommendations</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {recommendations.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

interface AuditEntryProps {
  event: {
    event_type: string;
    agent_name: string;
    model_used: string;
    duration_ms: number;
    tokens_used: number;
    cost_usd: number;
    error_message?: string;
  };
}

export function AuditEntry({ event }: AuditEntryProps) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <Badge
          variant={event.error_message ? "destructive" : "outline"}
          className="text-[10px] px-1.5"
        >
          {event.event_type}
        </Badge>
        <span className="text-muted-foreground">
          {event.agent_name?.replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        {event.model_used && event.model_used !== "tool" && (
          <span className="font-mono">{event.model_used.split("-").slice(0, 2).join("-")}</span>
        )}
        {event.tokens_used > 0 && <span>{event.tokens_used.toLocaleString()} tok</span>}
        {event.duration_ms > 0 && <span>{(event.duration_ms / 1000).toFixed(1)}s</span>}
      </div>
    </div>
  );
}
