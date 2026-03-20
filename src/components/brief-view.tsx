"use client";

import { useState } from "react";
import type { StrategicBrief } from "@/lib/agents/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getVerdict, getPriority, getConfidence, getScoreColor, penaltyLabels } from "@/lib/design-tokens";

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

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border ${accent ? "border-primary/30 bg-primary/[0.02]" : "bg-card"} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
      >
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 sm:px-6 pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

export function BriefView({ brief, allExpanded }: { brief: StrategicBrief; allExpanded?: boolean }) {
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
      <CollapsibleSection
        title="Decision Agenda"
        subtitle="Decisions you must make — ranked by urgency"
        defaultOpen={true}
        accent={true}
      >
        <div className="space-y-3">
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
      </CollapsibleSection>

      {/* Why Work / Fail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold text-status-success mb-3 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Why This May Work
          </h3>
          <ul className="space-y-2.5">
            {brief.whyThisMayWork.map((r, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-status-success shrink-0 mt-0.5">+</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-5">
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

      {/* What Must Be True */}
      <CollapsibleSection title="What Must Be True" subtitle="If any of these are false, reconsider" defaultOpen={true}>
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
      </CollapsibleSection>

      {/* Market View */}
      <CollapsibleSection title="Market View" defaultOpen={allExpanded ?? false}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">TAM</p>
              <p className="text-sm font-medium">{brief.market.tam}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Positioning</p>
              <p className="text-sm font-medium">{brief.market.positioning}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Buyer Profile</p>
            <p className="text-sm">{brief.market.buyerProfile}</p>
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-3">Competitive Landscape</h4>
            <div className="space-y-2">
              {brief.market.competitors.map((c, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getConfidence(c.confidence).badge}`}>
                      {c.confidence}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex gap-1.5">
                      <span className="text-status-error shrink-0 font-bold text-xs mt-0.5">THEM</span>
                      <span className="text-muted-foreground">{c.whyTheyWin}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-status-success shrink-0 font-bold text-xs mt-0.5">YOU</span>
                      <span className="text-muted-foreground">{c.whyYouCouldBeatThem}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Founder Fit */}
      <CollapsibleSection title="Founder Fit" defaultOpen={allExpanded ?? false}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-status-success mb-2">Strengths</p>
              <ul className="space-y-1.5">
                {brief.founderFit.strengths.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-status-success shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-status-error mb-2">Gaps</p>
              <ul className="space-y-1.5">
                {brief.founderFit.gaps.map((g, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-status-error shrink-0">-</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <span className="font-semibold">Recommendation: </span>{brief.founderFit.recommendation}
          </div>
        </div>
      </CollapsibleSection>

      {/* 7-Day Validation Sprint */}
      <CollapsibleSection
        title="7-Day Validation Sprint"
        subtitle="What to do this week to validate or kill this idea"
        defaultOpen={true}
      >
        <div className="space-y-0">
          {brief.validationSprint.map((s, i) => (
            <div key={i} className={`flex gap-4 py-3 ${i > 0 ? "border-t border-border/50" : ""}`}>
              <div className="shrink-0 w-16">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{s.day}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{s.task}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground/70">Go/no-go:</span> {s.successCriteria}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Critical Technical Decision */}
      <CollapsibleSection title="Critical Technical Decision" defaultOpen={allExpanded ?? false}>
        <div className="space-y-3">
          <p className="font-medium">{brief.criticalTechnicalDecision.question}</p>
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <span className="font-semibold">Recommendation: </span>
            {brief.criticalTechnicalDecision.recommendation}
          </div>
          <p className="text-sm text-muted-foreground">{brief.criticalTechnicalDecision.rationale}</p>
        </div>
      </CollapsibleSection>

      {/* Assumption Ledger */}
      <CollapsibleSection
        title="Assumption Ledger"
        subtitle="Every claim tagged by confidence level"
        defaultOpen={allExpanded ?? false}
      >
        <div className="space-y-2">
          {brief.assumptionLedger.map((a, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-start gap-2 mb-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${getConfidence(a.confidence).badge}`}>
                  {a.confidence}
                </span>
                <span className="text-sm font-medium">{a.assumption}</span>
              </div>
              <p className="text-xs text-muted-foreground ml-1 mt-1">
                <span className="font-semibold">Validate:</span> {a.howToValidate}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
