"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getVerdict } from "@/lib/design-tokens";

interface Thread {
  id: string;
  name: string;
  latest_verdict: string | null;
  latest_score: number | null;
  run_count: number;
}

interface CompareData {
  thread: Thread;
  latestRun: {
    id: string;
    result: Record<string, unknown>;
  } | null;
}

interface CompareModalProps {
  open: boolean;
  onClose: () => void;
  threads: Thread[];
}

const DIMENSIONS = ["team", "market", "traction", "defensibility", "timing"];

export function CompareModal({ open, onClose, threads }: CompareModalProps) {
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [dataA, setDataA] = useState<CompareData | null>(null);
  const [dataB, setDataB] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedA || !selectedB) return;
    setLoading(true);
    const token = localStorage.getItem("council_owner_token") ?? "";
    fetch(`/api/compare?a=${selectedA}&b=${selectedB}&token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setDataA(data.a);
          setDataB(data.b);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedA, selectedB]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] rounded-xl border bg-card shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="text-sm font-semibold">Compare Ideas</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selection */}
        <div className="grid grid-cols-2 gap-3 p-4 border-b shrink-0">
          {[
            { value: selectedA, setter: setSelectedA, label: "First idea" },
            { value: selectedB, setter: setSelectedB, label: "Second idea" },
          ].map(({ value, setter, label }) => (
            <select
              key={label}
              value={value ?? ""}
              onChange={(e) => setter(e.target.value || null)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">{label}...</option>
              {threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ))}
        </div>

        {/* Comparison */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading...
            </p>
          )}

          {dataA && dataB && !loading && (
            <div className="space-y-4">
              {/* Score comparison */}
              <div className="grid grid-cols-2 gap-3">
                {[dataA, dataB].map((data) => {
                  const verdict = data.thread.latest_verdict?.toLowerCase() ?? "";
                  const vc = getVerdict(verdict as "strong" | "promising" | "risky" | "weak");
                  return (
                    <div key={data.thread.id} className="rounded-lg border p-3 text-center">
                      <p className="text-sm font-medium truncate">{data.thread.name}</p>
                      <p className="text-2xl font-bold tabular-nums mt-1">
                        {data.thread.latest_score ?? "—"}
                      </p>
                      {data.thread.latest_verdict && (
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${vc.bg} ${vc.text}`}>
                          {data.thread.latest_verdict.toUpperCase()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Dimension bars */}
              <div className="space-y-2">
                {DIMENSIONS.map((dim) => {
                  const scoreA = extractDimensionScore(dataA, dim);
                  const scoreB = extractDimensionScore(dataB, dim);
                  return (
                    <div key={dim} className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-muted-foreground w-20 text-right capitalize">
                        {dim}
                      </span>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/40"
                            style={{ width: `${(scoreA / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums w-4 text-center">{scoreA}</span>
                      </div>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-foreground/40"
                            style={{ width: `${(scoreB / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums w-4 text-center">{scoreB}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!selectedA || !selectedB ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Select two ideas to compare
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function extractDimensionScore(
  data: CompareData,
  dimension: string
): number {
  const result = data.latestRun?.result;
  if (!result) return 0;
  const scores = result.dimensionScores as Record<string, { score?: number }> | undefined;
  return scores?.[dimension]?.score ?? 0;
}
