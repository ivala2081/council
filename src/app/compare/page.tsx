"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getVerdict, getScoreColor } from "@/lib/design-tokens";
import { Suspense } from "react";

const dimensionLabels: Record<string, string> = {
  team: "Team",
  market: "Market",
  traction: "Traction",
  defensibility: "Defensibility",
  timing: "Timing",
};

interface ThreadData {
  thread: {
    id: string;
    name: string;
    latest_verdict: string | null;
    latest_score: number | null;
    run_count: number;
  };
  latestRun: {
    id: string;
    prompt: string;
    result: Record<string, unknown> | null;
    run_number: number;
  } | null;
}

function getBreakdown(data: ThreadData | null): Record<string, number> {
  if (!data?.latestRun?.result) return {};
  const v = data.latestRun.result.verdict as Record<string, unknown> | undefined;
  return (v?.scoreBreakdown as Record<string, number>) ?? {};
}

function getPenalties(data: ThreadData | null): string[] {
  if (!data?.latestRun?.result) return [];
  const v = data.latestRun.result.verdict as Record<string, unknown> | undefined;
  const penalties = v?.penalties as Array<{ id: string; applied: boolean }> | undefined;
  return penalties?.filter((p) => p.applied).map((p) => p.id) ?? [];
}

function getRisks(data: ThreadData | null): string[] {
  if (!data?.latestRun?.result) return [];
  return (data.latestRun.result.whyThisMayFail as string[]) ?? [];
}

function getStrengths(data: ThreadData | null): string[] {
  if (!data?.latestRun?.result) return [];
  return (data.latestRun.result.whyThisMayWork as string[]) ?? [];
}

function ScoreBar({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = getScoreColor(value, max);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-5 text-right">{value}</span>
    </div>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const aId = searchParams.get("a");
  const bId = searchParams.get("b");

  const [dataA, setDataA] = useState<ThreadData | null>(null);
  const [dataB, setDataB] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Thread picker state
  const [threads, setThreads] = useState<Array<{ id: string; name: string; latest_verdict: string | null; latest_score: number | null }>>([]);
  const [pickingSlot, setPickingSlot] = useState<"a" | "b" | null>(null);

  useEffect(() => {
    // Load threads for picker
    const token = typeof window !== "undefined" ? localStorage.getItem("council_owner_token") : null;
    if (token) {
      fetch(`/api/threads?token=${token}`)
        .then((r) => r.json())
        .then((data) => setThreads(data.threads ?? []))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!aId || !bId) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("council_owner_token") ?? "";
    fetch(`/api/compare?a=${aId}&b=${bId}&token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setDataA(data.a);
          setDataB(data.b);
        }
      })
      .catch(() => setError("Failed to load comparison"))
      .finally(() => setLoading(false));
  }, [aId, bId]);

  const dimensions = ["team", "market", "traction", "defensibility", "timing"];
  const breakdownA = getBreakdown(dataA);
  const breakdownB = getBreakdown(dataB);

  // Thread picker UI (when no IDs selected)
  if (!aId || !bId) {
    const selectedA = searchParams.get("a");
    const selectedB = searchParams.get("b");

    return (
      <div className="max-w-2xl mx-auto py-12">
        <h2 className="text-lg font-semibold mb-6 text-center">Compare two ideas</h2>
        <div className="grid grid-cols-2 gap-4">
          {["a", "b"].map((slot) => {
            const selected = slot === "a" ? selectedA : selectedB;
            const isPicking = pickingSlot === slot;
            return (
              <div key={slot} className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase">
                  Idea {slot.toUpperCase()}
                </p>
                {isPicking ? (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {threads
                      .filter((t) => t.id !== (slot === "a" ? selectedB : selectedA))
                      .map((t) => {
                        const vc = t.latest_verdict ? getVerdict(t.latest_verdict) : null;
                        const isSelected = selected === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              const params = new URLSearchParams(searchParams.toString());
                              params.set(slot, t.id);
                              window.location.href = `/compare?${params.toString()}`;
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                              isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                            }`}
                          >
                            <p className="text-sm line-clamp-1">{t.name}</p>
                            {vc && t.latest_verdict && (
                              <span className={`text-[10px] font-semibold ${vc.text}`}>
                                {t.latest_verdict.toUpperCase()} · {t.latest_score}
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <button
                    onClick={() => setPickingSlot(slot as "a" | "b")}
                    className="w-full px-4 py-8 rounded-xl border-2 border-dashed hover:border-primary/30 hover:bg-muted/20 transition-colors text-center"
                  >
                    {selected ? (
                      <p className="text-sm">{threads.find((t) => t.id === selected)?.name ?? "Selected"}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a thread</p>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-12">Loading comparison...</p>;
  }

  if (error || !dataA || !dataB) {
    return <p className="text-sm text-status-error text-center py-12">{error ?? "Failed to load"}</p>;
  }

  const penaltiesA = getPenalties(dataA);
  const penaltiesB = getPenalties(dataB);
  const risksA = getRisks(dataA);
  const risksB = getRisks(dataB);
  const strengthsA = getStrengths(dataA);
  const strengthsB = getStrengths(dataB);

  const scoreA = dataA.thread.latest_score ?? 0;
  const scoreB = dataB.thread.latest_score ?? 0;
  const winner = scoreA > scoreB ? "a" : scoreB > scoreA ? "b" : null;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      {/* Title cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { data: dataA, side: "a" as const },
          { data: dataB, side: "b" as const },
        ].map(({ data, side }) => {
          const vc = data.thread.latest_verdict ? getVerdict(data.thread.latest_verdict) : null;
          const isWinner = winner === side;
          return (
            <a
              key={side}
              href={`/thread/${data.thread.id}`}
              className={`rounded-xl border p-4 hover:bg-muted/30 transition-colors ${
                isWinner ? "border-primary/30 bg-primary/5" : "bg-card"
              }`}
            >
              <p className="text-sm font-medium line-clamp-2 mb-2">{data.thread.name}</p>
              <div className="flex items-center gap-2">
                {vc && data.thread.latest_verdict && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${vc.bg} ${vc.text}`}>
                    {data.thread.latest_verdict.toUpperCase()}
                  </span>
                )}
                <span className="text-lg font-bold tabular-nums">{data.thread.latest_score ?? "—"}</span>
                {isWinner && (
                  <span className="text-[10px] text-primary font-semibold ml-auto">STRONGER</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {data.thread.run_count} {data.thread.run_count === 1 ? "run" : "runs"}
              </p>
            </a>
          );
        })}
      </div>

      {/* Score breakdown comparison */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Score Breakdown</h3>
        <div className="space-y-3">
          {dimensions.map((dim) => {
            const a = breakdownA[dim] ?? 0;
            const b = breakdownB[dim] ?? 0;
            const diff = a - b;
            return (
              <div key={dim}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground capitalize">{dimensionLabels[dim]}</span>
                  {diff !== 0 && (
                    <span className={`text-[10px] font-semibold ${diff > 0 ? "text-status-info" : "text-status-warning"}`}>
                      {diff > 0 ? "A" : "B"} +{Math.abs(diff)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ScoreBar value={a} />
                  <ScoreBar value={b} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Penalties */}
      {(penaltiesA.length > 0 || penaltiesB.length > 0) && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Penalties</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              {penaltiesA.length === 0 ? (
                <p className="text-xs text-status-success">No penalties</p>
              ) : (
                penaltiesA.map((p) => (
                  <span key={p} className="inline-block text-xs bg-status-error/10 text-status-error px-2 py-0.5 rounded-full mr-1 mb-1">
                    {p}
                  </span>
                ))
              )}
            </div>
            <div>
              {penaltiesB.length === 0 ? (
                <p className="text-xs text-status-success">No penalties</p>
              ) : (
                penaltiesB.map((p) => (
                  <span key={p} className="inline-block text-xs bg-status-error/10 text-status-error px-2 py-0.5 rounded-full mr-1 mb-1">
                    {p}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Strengths comparison */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Why it may work</h3>
        <div className="grid grid-cols-2 gap-4">
          {[strengthsA, strengthsB].map((strengths, i) => (
            <div key={i} className="space-y-1.5">
              {strengths.slice(0, 3).map((s, j) => (
                <p key={j} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-status-success mr-1">+</span>{s}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Risks comparison */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Why it may fail</h3>
        <div className="grid grid-cols-2 gap-4">
          {[risksA, risksB].map((risks, i) => (
            <div key={i} className="space-y-1.5">
              {risks.slice(0, 3).map((r, j) => (
                <p key={j} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-status-error mr-1">-</span>{r}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Quick verdict */}
      {winner && (
        <div className="rounded-xl border bg-muted/30 p-5 text-center">
          <p className="text-sm">
            <span className="font-semibold">
              {winner === "a" ? dataA.thread.name : dataB.thread.name}
            </span>
            {" "}scores higher by{" "}
            <span className="font-semibold tabular-nums">{Math.abs(scoreA - scoreB)} points</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Based on latest run from each thread
          </p>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="px-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-12">Loading...</p>}>
          <CompareContent />
        </Suspense>
      </main>
    </div>
  );
}
