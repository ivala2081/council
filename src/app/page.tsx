"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { VerdictCard } from "@/components/verdict-card";
import { v2VerdictSchema, type V2Verdict } from "@/lib/agents/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { trackEvent } from "@/lib/track-event";
import { CouncilMark } from "@/components/council-mark";
import { LoadingDots } from "@/components/loading-dots";
import { useLang } from "@/lib/i18n";
import { encodeVerdict, type ShareableVerdict } from "@/lib/verdict-share";
import { addToHistory, getHistory, clearHistory, type HistoryEntry } from "@/lib/storage";

// ============================================================
// State
// ============================================================

type ViewState = "idle" | "input" | "loading" | "verdict";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "<1m"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const EXAMPLES = [
  { icon: "💡", text: "Instagram clone yapmak istiyorum" },
  { icon: "⚙️", text: "AI tool that reads legal contracts for freelancers" },
  { icon: "🚀", text: "Platform for companies to manage AI agent workforce" },
];

// ============================================================
// Page
// ============================================================

export default function Home() {
  const { t } = useLang();
  const [viewState, setViewState] = useState<ViewState>("input");
  const [idea, setIdea] = useState("");
  const [verdict, setVerdict] = useState<V2Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdictId, setVerdictId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const lastIdeaRef = useRef<string>("");
  const reEvalEntryRef = useRef<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadingSteps = [
    { delay: 0, text: t("loading_step_1") },
    { delay: 3000, text: t("loading_step_2") },
    { delay: 8000, text: t("loading_step_3") },
    { delay: 15000, text: t("loading_step_4") },
    { delay: 25000, text: t("loading_step_5") },
  ];

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory());
  }, []);

  // Loading step timers
  useEffect(() => {
    if (viewState !== "loading") {
      setLoadingStep(0);
      return;
    }
    const timers = loadingSteps.map((step, i) =>
      setTimeout(() => setLoadingStep(i), step.delay),
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState]);

  const handleSubmit = useCallback(async () => {
    if (!idea.trim() || idea.trim().length < 10 || isLoading) return;

    lastIdeaRef.current = idea.trim();
    setIsLoading(true);
    setError(null);
    setVerdict(null);
    setViewState("loading");

    try {
      const fetchBody: Record<string, unknown> = { idea: idea.trim() }
      if (reEvalEntryRef.current) {
        fetchBody.previousVerdict = {
          idea: reEvalEntryRef.current.idea,
          verdict: reEvalEntryRef.current.verdict,
          confidence: reEvalEntryRef.current.confidence,
          ideaSummary: reEvalEntryRef.current.ideaSummary,
        }
      }

      const res = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fetchBody),
      });

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error?.message ?? "Request failed");
      }

      const result = v2VerdictSchema.safeParse(json.data);
      if (!result.success) {
        throw new Error("Invalid verdict format received");
      }

      setVerdict(result.data);
      setViewState("verdict");

      // Generate shareable verdict ID
      // Truncate texts to keep URL < 500 chars (spec says "shortened")
      const shorten = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + "…" : s;
      const shareable: ShareableVerdict = {
        v: result.data.verdict,
        s: shorten(result.data.idea_summary, 80),
        c: result.data.confidence.score,
        r: result.data.reasons.map(r => shorten(r.text, 100)).slice(0, 3) as [string, string, string],
        ...(result.data.pivot_suggestion?.suggestion && { p: shorten(result.data.pivot_suggestion.suggestion, 100) }),
      }
      setVerdictId(encodeVerdict(shareable));

      // Save to history
      const historyEntry: HistoryEntry = {
        id: encodeVerdict(shareable),
        idea: idea.trim().slice(0, 100),
        verdict: result.data.verdict,
        confidence: result.data.confidence.score,
        ideaSummary: result.data.idea_summary,
        timestamp: Date.now(),
      }
      addToHistory(historyEntry)
      setHistory(getHistory())

      // Log meta for debugging (not shown to user)
      console.log("[verdict]", {
        verdict: result.data.verdict,
        confidence: result.data.confidence.score,
        duration_ms: json.meta?.duration_ms,
        cost_usd: json.meta?.cost_usd,
      });

      trackEvent({
        event: "verdict_generated",
        verdict: result.data.verdict,
        score: result.data.confidence.score,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setViewState("input");
    } finally {
      setIsLoading(false);
    }
  }, [idea, isLoading]);

  const handleNotQuite = () => {
    setIdea(lastIdeaRef.current);
    setVerdict(null);
    setError(null);
    setViewState("input");
  };

  const handleReEvaluate = (entry: HistoryEntry) => {
    reEvalEntryRef.current = entry;
    setIdea(entry.idea);
    setVerdict(null);
    setError(null);
    setViewState("input");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <CouncilMark className="w-5 h-5 text-foreground transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-semibold tracking-tight">Council</span>
          </Link>
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
            {(viewState === "verdict" || viewState === "loading") && (
              <button
                onClick={() => {
                  setIdea("");
                  setVerdict(null);
                  setError(null);
                  reEvalEntryRef.current = null;
                  setViewState("input");
                }}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                title={t("new_idea_tooltip")}
              >
                <svg className="w-[18px] h-[18px] text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6">
        {/* Input */}
        {viewState === "input" && (
          <div className="flex-1 flex flex-col items-center pt-[10vh]">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              {t("headline")}
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              {t("subheadline")}
            </p>

            {/* Value proposition — 3 pillars */}
            <div className="flex items-center justify-center gap-6 mb-8 text-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-foreground">{t("value_prop_1")}</span>
                <span className="text-xs text-muted-foreground/70">{t("value_prop_1_desc")}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-foreground">{t("value_prop_2")}</span>
                <span className="text-xs text-muted-foreground/70">{t("value_prop_2_desc")}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-foreground">{t("value_prop_3")}</span>
                <span className="text-xs text-muted-foreground/70">{t("value_prop_3_desc")}</span>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div className="relative rounded-2xl border border-border/60 bg-card shadow-sm">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    rows={4}
                    placeholder={t("placeholder")}
                    className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
                    disabled={isLoading}
                    autoFocus
                  />
                  <div className="flex items-center justify-end px-3 pb-3">
                    <button
                      type="submit"
                      disabled={isLoading || idea.trim().length < 10}
                      className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-15 hover:opacity-80 transition-all"
                    >
                      {t("submit_button")}
                    </button>
                  </div>
                </div>
              </form>

              {/* Landing example chips — only when idea is empty */}
              {idea.trim().length === 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground/70 mr-1">{t("try_label")}</span>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.text}
                      type="button"
                      onClick={() => { setIdea(ex.text); reEvalEntryRef.current = null }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="mr-1">{ex.icon}</span>
                      {ex.text.length > 45 ? ex.text.slice(0, 42) + "…" : ex.text}
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
                  {error}
                  <button
                    onClick={handleSubmit}
                    className="ml-2 underline hover:no-underline"
                  >
                    {t("try_again")}
                  </button>
                </div>
              )}

              {/* Verdict history */}
              {history.length > 0 && idea.trim().length === 0 && (
                <div className="mt-6 border-t border-border/30 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {t("history_title")}
                    </p>
                    {showClearConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/70">{t("history_clear_confirm")}</span>
                        <button
                          onClick={() => { clearHistory(); setHistory([]); setShowClearConfirm(false) }}
                          className="text-xs text-red-500 hover:text-red-400"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="text-xs text-muted-foreground"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        {t("history_clear")}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {history.slice(0, 5).map((entry) => {
                      const badge = entry.verdict === "GO"
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        : entry.verdict === "PIVOT"
                          ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          : "text-red-600 dark:text-red-400 bg-red-500/10"
                      const timeAgo = formatTimeAgo(entry.timestamp)

                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-card/50 hover:bg-muted/30 transition-colors group"
                        >
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${badge} shrink-0`}>
                            {entry.verdict === "DONT" ? "DON'T" : entry.verdict}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate">{entry.ideaSummary}</p>
                            <p className="text-xs text-muted-foreground/70">{entry.confidence}% · {timeAgo}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={`/v/${entry.id}`}
                              className="text-xs px-2 py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {t("history_view")}
                            </a>
                            <button
                              onClick={() => handleReEvaluate(entry)}
                              className="text-xs px-2 py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {t("history_re_evaluate")}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground/60 text-center mt-4 select-none">
                {t("input_hint")}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {viewState === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <CouncilMark className="w-8 h-8 text-foreground/60 mb-6 animate-pulse" />
            <div className="space-y-2 text-sm">
              {loadingSteps.slice(0, loadingStep + 1).map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i < loadingStep ? (
                    <span className="text-emerald-500">✓</span>
                  ) : (
                    <LoadingDots />
                  )}
                  <span className={i < loadingStep ? "text-muted-foreground" : "text-foreground"}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70 mt-6">
              {t("loading_estimate")}
            </p>
          </div>
        )}

        {/* Verdict */}
        {viewState === "verdict" && verdict && (
          <div className="py-8">
            {/* Re-evaluation badge */}
            {reEvalEntryRef.current && (
              <div className="max-w-xl mx-auto mb-3 px-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  {t("re_eval_badge")} &middot; {t("re_eval_previous")}: {reEvalEntryRef.current.verdict} ({reEvalEntryRef.current.confidence}%)
                </div>
              </div>
            )}

            {/* Council heard header */}
            <div className="max-w-xl mx-auto mb-4 px-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-1">
                {t("council_heard")}
              </p>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground leading-relaxed italic">
                  &ldquo;{verdict.idea_summary}&rdquo;
                </p>
                <button
                  onClick={handleNotQuite}
                  className="shrink-0 text-xs text-muted-foreground/70 hover:text-foreground transition-colors whitespace-nowrap"
                >
                  {t("not_quite")}
                </button>
              </div>
            </div>

            <VerdictCard verdict={verdict} missionId={null} verdictId={verdictId} />

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIdea("");
                  setVerdict(null);
                  setVerdictId(null);
                  setError(null);
                  lastIdeaRef.current = "";
                  reEvalEntryRef.current = null;
                  setViewState("input");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("try_another")}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
          <a
            href="https://github.com/ivala2081/council"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            {t("footer_open_source")}
          </a>
          <span className="text-muted-foreground/20">&middot;</span>
          <span>{t("footer_built_with")}</span>
        </div>
      </footer>
    </div>
  );
}
