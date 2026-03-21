"use client";

import { CouncilMark } from "@/components/council-mark";
import { ScoreSparkline } from "@/components/score-sparkline";
import { getVerdict } from "@/lib/design-tokens";

interface ShareContentProps {
  thread: {
    id: string;
    name: string;
    latest_verdict: string | null;
    latest_score: number | null;
    run_count: number;
    created_at: string;
  };
  scores: number[];
  verdicts: string[];
  runCount: number;
}

export function ShareContent({
  thread,
  scores,
  verdicts,
  runCount,
}: ShareContentProps) {
  const firstScore = scores[0] ?? 0;
  const lastScore = scores[scores.length - 1] ?? 0;
  const firstVerdict = verdicts[0] ?? "";
  const lastVerdict = verdicts[verdicts.length - 1] ?? "";

  const vc = thread.latest_verdict
    ? getVerdict(thread.latest_verdict.toLowerCase() as "strong" | "promising" | "risky" | "weak")
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border bg-card p-8 text-center shadow-lg">
          <CouncilMark className="w-8 h-8 mx-auto mb-6" />

          <h1 className="text-lg font-semibold line-clamp-2">{thread.name}</h1>

          {/* Score transformation */}
          {scores.length >= 2 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{firstScore}</p>
                {firstVerdict && (
                  <p className="text-xs text-muted-foreground uppercase mt-1">
                    {firstVerdict}
                  </p>
                )}
              </div>
              <svg className="w-6 h-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12h14m-7-7 7 7-7 7" />
              </svg>
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">{lastScore}</p>
                {lastVerdict && vc && (
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${vc.bg} ${vc.text}`}>
                    {lastVerdict.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sparkline */}
          {scores.length >= 2 && (
            <div className="mt-4 flex justify-center">
              <ScoreSparkline
                scores={scores}
                width={200}
                height={60}
                latestVerdict={thread.latest_verdict ?? undefined}
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            {runCount} run{runCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* CTA */}
        <a
          href="/"
          className="block mt-6 text-center rounded-xl bg-foreground text-background px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          What&apos;s your idea&apos;s score?
        </a>

        <p className="text-[10px] text-muted-foreground/40 text-center mt-3">
          Powered by Council
        </p>
      </div>
    </div>
  );
}
