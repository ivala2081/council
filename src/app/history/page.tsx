"use client";

import { useEffect, useState } from "react";
import { CouncilMark } from "@/components/council-mark";
import { AppHeader } from "@/components/app-header";
import { getVerdict } from "@/lib/design-tokens";

interface ThreadSummary {
  id: string;
  name: string;
  latest_verdict: string | null;
  latest_score: number | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

function getOwnerToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("council_owner_token") ?? "";
}

export default function HistoryPage() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getOwnerToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`/api/threads?token=${token}`)
      .then((r) => r.json())
      .then((data) => setThreads(data.threads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Your Threads</h2>
          {threads.length >= 2 && (
            <a
              href="/compare"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Compare
            </a>
          )}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        )}

        {!loading && threads.length === 0 && (
          <div className="text-center py-16">
            <CouncilMark className="w-8 h-8 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-3">No threads yet.</p>
            <a href="/" className="text-sm text-primary hover:underline">
              Start your first evaluation
            </a>
          </div>
        )}

        <div className="space-y-2">
          {threads.map((t) => {
            const vc = t.latest_verdict ? getVerdict(t.latest_verdict) : null;
            return (
              <a key={t.id} href={`/thread/${t.id}`} className="block group">
                <div className="rounded-xl border bg-card px-4 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1 group-hover:text-foreground transition-colors">
                        {t.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {t.run_count} {t.run_count === 1 ? "run" : "runs"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          · {new Date(t.updated_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {vc && t.latest_verdict && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${vc.bg}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${vc.dot}`} />
                          <span className={`text-[11px] font-semibold ${vc.text}`}>
                            {t.latest_verdict.toUpperCase()}
                          </span>
                        </div>
                      )}
                      {t.latest_score !== null && (
                        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                          {t.latest_score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </main>
    </div>
  );
}
