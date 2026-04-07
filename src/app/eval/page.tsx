"use client";

import { useState, useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import data from "../../../benchmark/results/v2-eval-2026-04-06T23-03-53-595Z.json";

// ---- types ----
interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

interface TestResult {
  id: string;
  category: string;
  input: string;
  expected_verdict: string;
  actual_verdict: string | null;
  confidence: { score: number; label: string } | null;
  checks: Check[];
  raw_output: Record<string, unknown> | null;
  timing_ms: number;
  tokens: { input: number; output: number; cache_read: number; cache_write: number };
  cost_usd: number;
  error: string | null;
}

type VerdictType = "GO" | "PIVOT" | "DONT";
type Filter = "all" | "pass" | "fail";

// ---- verdict styling ----
const verdictStyle: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  GO: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    border: "border-emerald-500/20",
  },
  PIVOT: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-500/20",
  },
  DONT: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    border: "border-red-500/20",
  },
};

const categoryLabel: Record<string, string> = {
  clear_dont: "Clear DONT",
  clear_go: "Clear GO",
  clear_pivot: "Clear PIVOT",
  vague_input: "Vague Input",
  regulated_industry: "Regulated",
  saturated_market: "Saturated",
  good_niche: "Good Niche",
  hardware_complex: "Hardware",
  timing_play: "Timing",
  local_market: "Local Market",
  b2b_saas: "B2B SaaS",
  social_network: "Social",
  crypto_web3: "Crypto/Web3",
  education: "Education",
  low_confidence: "Low Confidence",
  already_exists: "Already Exists",
  creator_economy: "Creator",
  deeptech: "DeepTech",
  marketplace: "Marketplace",
  ai_wrapper: "AI Wrapper",
};

// ---- computed ----
const meta = data.meta;
const results: TestResult[] = data.results as TestResult[];

function getPassRate(r: TestResult): { passed: number; total: number } {
  const passed = r.checks.filter((c) => c.passed).length;
  return { passed, total: r.checks.length };
}

function isPass(r: TestResult): boolean {
  return r.checks.every((c) => c.passed);
}

// ---- sub-components ----

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-4 text-center ring-1 ring-foreground/5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono tabular-nums text-muted-foreground w-8 text-right">{score}</span>
    </div>
  );
}

function CheckPill({ check }: { check: Check }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
        check.passed
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
    >
      {check.passed ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {check.name.replace(/_/g, " ")}
    </span>
  );
}

function ExpandedDetail({ result, failedChecks }: { result: TestResult; failedChecks: Check[] }) {
  const reasons = result.raw_output?.reasons as Array<{ text: string; evidence?: { type?: string } }> | undefined;

  return (
    <div className="space-y-3 pt-1 border-t border-border/50">
      {/* All checks */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Checks</p>
        <div className="flex flex-wrap gap-1.5">
          {result.checks.map((c) => (
            <CheckPill key={c.name} check={c} />
          ))}
        </div>
      </div>

      {/* Failed details */}
      {failedChecks.length > 0 ? (
        <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 space-y-1">
          {failedChecks.map((c) => (
            <p key={c.name} className="text-xs text-red-600 dark:text-red-400">
              <span className="font-semibold">{c.name}:</span> {c.detail}
            </p>
          ))}
        </div>
      ) : null}

      {/* Reasons */}
      {reasons ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reasons</p>
          <div className="space-y-2">
            {reasons.map((reason, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-foreground leading-relaxed">{reason.text}</p>
                  {reason.evidence?.type ? (
                    <span className="text-[10px] font-medium text-muted-foreground mt-0.5 inline-block px-1.5 py-0.5 bg-muted rounded">
                      {reason.evidence.type}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground pt-1">
        <span>
          Expected: <strong className="text-foreground">{result.expected_verdict}</strong>
        </span>
        <span>{(result.timing_ms / 1000).toFixed(1)}s</span>
        <span>${result.cost_usd.toFixed(4)}</span>
        <span>{result.tokens.input + result.tokens.output} tokens</span>
      </div>
    </div>
  );
}

function TestCard({ result, index }: { result: TestResult; index: number }) {
  const [open, setOpen] = useState(false);
  const style = verdictStyle[result.actual_verdict ?? "DONT"] ?? verdictStyle.DONT;
  const allPassed = isPass(result);
  const { passed, total } = getPassRate(result);
  const failedChecks = result.checks.filter((c) => !c.passed);

  return (
    <Card
      className={`transition-all duration-200 cursor-pointer hover:ring-2 hover:ring-foreground/10 ${
        !allPassed ? "ring-red-500/20" : ""
      }`}
      size="sm"
      onClick={() => setOpen(!open)}
    >
      <CardContent className="space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${style.bg} ${style.text} ${style.border} border`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {result.actual_verdict ?? "ERR"}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              {categoryLabel[result.category] ?? result.category}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                allPassed
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {passed}/{total}
            </span>
            <svg
              className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Input */}
        <p className="text-sm text-foreground leading-relaxed">{result.input}</p>

        {/* Confidence bar */}
        {result.confidence ? <ConfidenceBar score={result.confidence.score} /> : null}

        {/* Quick fail indicators */}
        {!allPassed && !open ? (
          <div className="flex flex-wrap gap-1.5">
            {failedChecks.map((c) => (
              <CheckPill key={c.name} check={c} />
            ))}
          </div>
        ) : null}

        {/* Expanded detail */}
        {open ? <ExpandedDetail result={result} failedChecks={failedChecks} /> : null}
      </CardContent>
    </Card>
  );
}

// ---- main page ----
export default function EvalPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [verdictFilter, setVerdictFilter] = useState<VerdictType | "all">("all");

  const filtered = useMemo(() => {
    let r = results;
    if (filter === "pass") r = r.filter(isPass);
    if (filter === "fail") r = r.filter((x) => !isPass(x));
    if (verdictFilter !== "all") r = r.filter((x) => x.actual_verdict === verdictFilter);
    return r;
  }, [filter, verdictFilter]);

  // stats
  const totalCases = results.length;
  const verdictCorrect = results.filter((r) => r.checks.find((c) => c.name === "verdict_correct")?.passed).length;
  const allChecks = results.flatMap((r) => r.checks);
  const checkPassRate = ((allChecks.filter((c) => c.passed).length / allChecks.length) * 100).toFixed(1);
  const totalCost = results.reduce((s, r) => s + r.cost_usd, 0);
  const totalTime = results.reduce((s, r) => s + r.timing_ms, 0);
  const goCount = results.filter((r) => r.actual_verdict === "GO").length;
  const pivotCount = results.filter((r) => r.actual_verdict === "PIVOT").length;
  const dontCount = results.filter((r) => r.actual_verdict === "DONT").length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Eval Report</h1>
            <span className="text-xs font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground">
              v{meta.prompt_version}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {totalCases} golden test cases against{" "}
            <span className="font-mono font-medium text-foreground">{meta.model}</span>
            {" "}&middot;{" "}
            {new Date(meta.timestamp).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Score Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-card p-6 ring-1 ring-foreground/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Verdict Accuracy
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black tabular-nums text-foreground">
                  {verdictCorrect}/{totalCases}
                </span>
                <span
                  className={`text-2xl font-bold ${
                    verdictCorrect === totalCases
                      ? "text-emerald-500"
                      : verdictCorrect >= 17
                        ? "text-amber-500"
                        : "text-red-500"
                  }`}
                >
                  {((verdictCorrect / totalCases) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            {/* Verdict distribution mini chart */}
            <div className="flex items-end gap-1 h-16">
              {[
                { count: goCount, color: "bg-emerald-500", label: "GO" },
                { count: pivotCount, color: "bg-amber-500", label: "PIVOT" },
                { count: dontCount, color: "bg-red-500", label: "DONT" },
              ].map((v) => (
                <div key={v.label} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 rounded-t-md ${v.color} transition-all`}
                    style={{ height: `${Math.max(4, (v.count / totalCases) * 64)}px` }}
                  />
                  <span className="text-[10px] font-bold text-muted-foreground">{v.label}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{v.count}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Full-width accuracy bar */}
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                verdictCorrect === totalCases ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${(verdictCorrect / totalCases) * 100}%` }}
            />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Check Pass"
            value={`${checkPassRate}%`}
            sub={meta.check_pass_rate}
            accent={Number(checkPassRate) >= 95 ? "text-emerald-500" : "text-amber-500"}
          />
          <StatCard
            label="Schema Valid"
            value={`${results.filter((r) => r.checks.find((c) => c.name === "schema_valid")?.passed).length}/${totalCases}`}
            accent="text-foreground"
          />
          <StatCard
            label="Total Cost"
            value={`$${totalCost.toFixed(2)}`}
            sub={`${((results.reduce((s, r) => s + r.tokens.input + r.tokens.output, 0)) / 1000).toFixed(1)}K tokens`}
          />
          <StatCard
            label="Total Time"
            value={`${(totalTime / 1000).toFixed(0)}s`}
            sub={`avg ${(totalTime / totalCases / 1000).toFixed(1)}s/case`}
          />
        </div>

        <Separator />

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Filter:</span>
          {(["all", "pass", "fail"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/20"
              }`}
            >
              {f === "all" ? `All (${totalCases})` : f === "pass" ? `Pass (${results.filter(isPass).length})` : `Fail (${results.filter((x) => !isPass(x)).length})`}
            </button>
          ))}

          <span className="w-px h-5 bg-border mx-1" />

          {(["all", "GO", "PIVOT", "DONT"] as const).map((v) => {
            const style = v === "all" ? null : verdictStyle[v];
            const count = v === "all" ? totalCases : results.filter((r) => r.actual_verdict === v).length;
            return (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  verdictFilter === v
                    ? style
                      ? `${style.bg} ${style.text} ${style.border}`
                      : "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/20"
                }`}
              >
                {v} ({count})
              </button>
            );
          })}
        </div>

        {/* Test Results */}
        <div className="space-y-3">
          {filtered.map((r, i) => (
            <TestCard key={r.id} result={r} index={results.indexOf(r)} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No results match this filter.</div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to Council
          </a>
        </div>
      </main>
    </div>
  );
}
