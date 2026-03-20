"use client";

import type { ConciseBrief } from "@/lib/agents/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getVerdict, getPriority, getScoreColor, penaltyLabels } from "@/lib/design-tokens";

function ScoreGauge({ score, verdict: v }: { score: number; verdict: string }) {
  const config = getVerdict(v);
  const circumference = 2 * Math.PI * 54;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  return (
    <div className="relative w-32 h-32 sm:w-36 sm:h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" className="text-muted/50" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          className={config.ring}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${config.text}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, max = 20 }: { label: string; score: number; max?: number }) {
  const color = getScoreColor(score, max);
  const pct = (score / max) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${pct}%`, transition: "width 0.8s ease-out" }}
        />
      </div>
      <span className="text-sm font-mono w-10 text-right font-medium">{score}/{max}</span>
    </div>
  );
}

export function ConciseBriefView({ brief }: { brief: ConciseBrief }) {
  const { scoreBreakdown } = brief.verdict;
  const config = getVerdict(brief.verdict.verdict);
  const appliedPenalties = brief.verdict.penalties?.filter(p => p.applied) || [];

  return (
    <div className="space-y-4">
      {/* Verdict Hero */}
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreGauge score={brief.verdict.councilScore} verdict={brief.verdict.verdict} />
          <div className="flex-1 text-center sm:text-left">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} mb-3`}>
              <div className={`w-2 h-2 rounded-full ${config.dot}`} />
              <span className={`text-sm font-bold ${config.text}`}>{brief.verdict.verdict.toUpperCase()}</span>
            </div>
            <p className="text-[15px] leading-relaxed mb-3">{brief.verdict.summary}</p>
            {brief.verdict.verdictReasoning && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                {brief.verdict.verdictReasoning}
              </p>
            )}
          </div>
        </div>

        <Separator className="my-5" />

        <div className="space-y-2.5">
          <ScoreBar label="Team" score={scoreBreakdown.team} />
          <ScoreBar label="Market" score={scoreBreakdown.market} />
          <ScoreBar label="Traction" score={scoreBreakdown.traction} />
          <ScoreBar label="Defensibility" score={scoreBreakdown.defensibility} />
          <ScoreBar label="Timing" score={scoreBreakdown.timing} />
        </div>

        {appliedPenalties.length > 0 && (
          <>
            <Separator className="my-5" />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-status-error uppercase tracking-wider">Penalties Applied</p>
              {appliedPenalties.map((p) => (
                <div key={p.id} className="flex items-start gap-2 p-3 rounded-lg bg-status-error/5 border border-status-error/10">
                  <Badge className="bg-status-error/20 text-status-error border-0 shrink-0 text-xs font-medium">
                    -10 pts
                  </Badge>
                  <div>
                    <span className="text-sm font-medium">{penaltyLabels[p.id] || p.id}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.reason}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-1">
                Base: {brief.verdict.baseScore} - {appliedPenalties.length * 10} = Final: {brief.verdict.councilScore}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Decision Agenda */}
      <div className="rounded-xl border border-primary/30 bg-primary/[0.02] overflow-hidden">
        <div className="px-5 sm:px-6 py-4">
          <h3 className="font-semibold">Decision Agenda</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Decisions you must make — ranked by urgency</p>
        </div>
        <div className="px-5 sm:px-6 pb-5 space-y-3">
          {brief.decisionAgenda.map((d, i) => {
            const pc = getPriority(d.priority);
            return (
              <div key={i} className={`rounded-lg border p-4 ${pc.bg}`}>
                <div className="flex items-start gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 mt-1 ${pc.label}`}>
                    {d.priority}
                  </span>
                  <span className="font-semibold text-[15px]">{d.question}</span>
                </div>
                <div className="space-y-1.5 ml-4 mb-3">
                  {d.options.map((o, j) => (
                    <div key={j} className="text-sm flex gap-2">
                      <span className="text-muted-foreground shrink-0">{String.fromCharCode(65 + j)}.</span>
                      <span>
                        <span className="font-medium">{o.option}</span>
                        <span className="text-muted-foreground"> — {o.tradeoff}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-background/80 rounded-md text-sm">
                  <span className="font-semibold">Recommendation: </span>{d.recommendation}
                </div>
                {d.evidence && (
                  <p className="text-xs text-muted-foreground mt-2 pl-1">{d.evidence}</p>
                )}
                {d.secondOrderEffects && (
                  <p className="text-xs mt-1.5 pl-1">
                    <span className="font-medium">6-month impact: </span>
                    <span className="text-muted-foreground">{d.secondOrderEffects}</span>
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-2 pl-1">Deadline: {d.deadline}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* What Must Be True */}
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <h3 className="font-semibold mb-1">What Must Be True</h3>
        <p className="text-xs text-muted-foreground mb-4">If any of these are false, reconsider.</p>
        <ul className="space-y-2">
          {brief.whatMustBeTrue.map((a, i) => (
            <li key={i} className="text-sm flex gap-3 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground mt-0.5">
                {i + 1}
              </span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Why This May Fail */}
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <h3 className="font-semibold text-status-error mb-3 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Why This May Fail
        </h3>
        <ul className="space-y-2.5">
          {brief.whyThisMayFail.map((r, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-status-error shrink-0 mt-0.5">-</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
