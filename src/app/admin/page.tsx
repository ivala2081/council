"use client";

import { useState, useEffect } from "react";

const ADMIN_KEY = "council-admin-2026";

function CouncilMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 7.5C15.5 5.5 13 4.5 10.5 5C7.5 5.5 5.5 8 5.5 11C5.5 14 7.5 16.5 10.5 17C13 17.5 15.5 16.5 17 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 9.5C14 8.5 12.5 8 11 8.5C9.5 9 8.5 10.5 8.5 12C8.5 13.5 9.5 15 11 15.5C12.5 16 14 15.5 15 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" />
      <circle cx="19.5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

interface Stats {
  generatedAt: string;
  retention: {
    totalOwners: number;
    totalThreads: number;
    returningOwners: number;
    returnRate: number;
    avgDaysToReturn: number | null;
    threadsWithMultipleRuns: number;
  };
  missions: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    avgCostPerMission: number | null;
    totalSpend: number;
  };
  verdicts: Record<string, number>;
  scores: {
    avg: number | null;
    min: number | null;
    max: number | null;
    count: number;
  };
  feedback: {
    total: number;
    avgOverallScore: number | null;
    wouldPayRate: number | null;
  };
  cohorts: Array<{ week: string; total: number; returned: number; returnRate: number }>;
  timeToReturn: Record<string, number>;
  funnel: Record<string, number>;
  runHistogram: Record<number, number>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </div>
      {sub && <p className="text-xs text-muted-foreground/60 text-right">{sub}</p>}
    </div>
  );
}

const VERDICT_COLORS: Record<string, string> = {
  strong: "bg-emerald-500",
  promising: "bg-blue-500",
  risky: "bg-amber-500",
  weak: "bg-red-500",
};

const FUNNEL_ORDER = [
  { key: "brief_generated", label: "Brief Generated" },
  { key: "thread_viewed", label: "Thread Viewed" },
  { key: "second_run_submitted", label: "Second Run" },
  { key: "delta_banner_viewed", label: "Delta Viewed" },
];

const TIME_BUCKET_LABELS: Record<string, string> = {
  "0": "Same day",
  "1": "1 day",
  "2": "2 days",
  "3": "3 days",
  "4-7": "4-7 days",
  "7+": "7+ days",
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/stats?key=${ADMIN_KEY}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading stats...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-500 text-sm">Error: {error || "No data"}</p>
      </div>
    );
  }

  const totalVerdicts = Object.values(stats.verdicts).reduce((a, b) => a + b, 0);
  const funnelMax = Math.max(...Object.values(stats.funnel), 1);
  const timeMax = Math.max(...Object.values(stats.timeToReturn), 1);
  const histMax = Math.max(...Object.values(stats.runHistogram), 1);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CouncilMark className="w-5 h-5 text-foreground" />
            <span className="text-[15px] font-semibold tracking-tight">Council</span>
            <span className="text-xs text-muted-foreground ml-1">Admin</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(stats.generatedAt).toLocaleString()}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Row 1: Core metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Retention */}
          <Card title="Retention">
            <Metric label="Unique owners" value={stats.retention.totalOwners} />
            <Metric label="Total threads" value={stats.retention.totalThreads} />
            <Metric
              label="Return rate"
              value={`${stats.retention.returnRate}%`}
              sub={`${stats.retention.returningOwners} of ${stats.retention.totalOwners} owners returned`}
            />
            <Metric
              label="Avg days to return"
              value={stats.retention.avgDaysToReturn ?? "N/A"}
              sub={`${stats.retention.threadsWithMultipleRuns} threads with 2+ runs`}
            />
          </Card>

          {/* Missions */}
          <Card title="Missions">
            <Metric label="Total" value={stats.missions.total} />
            <Metric label="Completed" value={stats.missions.completed} />
            <Metric label="Failed" value={stats.missions.failed} />
            <Metric label="Running" value={stats.missions.running} />
            <Metric
              label="Avg cost"
              value={stats.missions.avgCostPerMission != null
                ? `$${stats.missions.avgCostPerMission.toFixed(4)}`
                : "N/A"}
            />
            <Metric
              label="Total spend"
              value={`$${stats.missions.totalSpend.toFixed(4)}`}
            />
          </Card>

          {/* Scores */}
          <Card title="Scores">
            <Metric label="Avg score" value={stats.scores.avg ?? "N/A"} />
            <Metric label="Min" value={stats.scores.min ?? "N/A"} />
            <Metric label="Max" value={stats.scores.max ?? "N/A"} />
            <Metric label="Scored briefs" value={stats.scores.count} />
          </Card>
        </div>

        {/* Row 2: Event Funnel + Cohorts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Event Funnel */}
          <Card title="Event Funnel">
            {FUNNEL_ORDER.map((step, i) => {
              const count = stats.funnel[step.key] ?? 0;
              const prev = i > 0 ? (stats.funnel[FUNNEL_ORDER[i - 1].key] ?? 0) : 0;
              const convRate = i > 0 && prev > 0 ? Math.round((count / prev) * 100) : null;
              return (
                <div key={step.key} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{step.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {count}
                      {convRate !== null && (
                        <span className="text-[11px] ml-1.5 text-muted-foreground/60">
                          ({convRate}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(count / funnelMax) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Share clicks</span>
                <span className="tabular-nums">{stats.funnel.share_clicked ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Feedback submitted</span>
                <span className="tabular-nums">{stats.funnel.feedback_submitted ?? 0}</span>
              </div>
            </div>
          </Card>

          {/* Weekly Cohorts */}
          <Card title="Weekly Cohorts (7-day return)">
            {stats.cohorts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-[11px]">
                      <th className="text-left font-medium pb-2">Week</th>
                      <th className="text-right font-medium pb-2">Users</th>
                      <th className="text-right font-medium pb-2">Returned</th>
                      <th className="text-right font-medium pb-2">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.cohorts.map((c) => (
                      <tr key={c.week} className="border-t border-border/50">
                        <td className="py-1.5 tabular-nums">{c.week}</td>
                        <td className="py-1.5 text-right tabular-nums">{c.total}</td>
                        <td className="py-1.5 text-right tabular-nums">{c.returned}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          <span className={
                            c.returnRate >= 30 ? "text-green-500 font-semibold" :
                            c.returnRate >= 10 ? "text-yellow-500 font-semibold" :
                            "text-muted-foreground"
                          }>
                            {c.returnRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Row 3: Time to Return + Run Histogram + Verdicts + Feedback */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Time to Return */}
          <Card title="Time to Return">
            {Object.entries(stats.timeToReturn).map(([bucket, count]) => (
              <div key={bucket} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{TIME_BUCKET_LABELS[bucket] ?? bucket}</span>
                  <span className="tabular-nums">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(count / timeMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>

          {/* Run Count Histogram */}
          <Card title="Runs per Thread">
            {Object.entries(stats.runHistogram)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([runs, count]) => (
                <div key={runs} className="mb-2 last:mb-0">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">
                      {Number(runs) >= 4 ? "4+" : runs} {Number(runs) === 1 ? "run" : "runs"}
                    </span>
                    <span className="tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(count / histMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </Card>

          {/* Verdict Distribution */}
          <Card title="Verdicts">
            {Object.entries(stats.verdicts).map(([verdict, count]) => (
              <div key={verdict} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="capitalize">{verdict}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count} ({totalVerdicts > 0 ? Math.round((count / totalVerdicts) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${VERDICT_COLORS[verdict] ?? "bg-muted-foreground"}`}
                    style={{ width: `${totalVerdicts > 0 ? (count / totalVerdicts) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>

          {/* Feedback */}
          <Card title="Feedback">
            <Metric label="Total feedbacks" value={stats.feedback.total} />
            <Metric
              label="Avg score"
              value={stats.feedback.avgOverallScore != null
                ? `${stats.feedback.avgOverallScore}/5`
                : "N/A"}
            />
            <Metric
              label="Would pay"
              value={stats.feedback.wouldPayRate != null
                ? `${stats.feedback.wouldPayRate}%`
                : "N/A"}
            />
          </Card>
        </div>
      </main>
    </div>
  );
}
