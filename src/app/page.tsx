"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { VerdictCard } from "@/components/verdict-card";
import { SampleVerdicts } from "@/components/sample-verdicts";
import { EntropyBg } from "@/components/entropy-bg";
import { LoadingSteps } from "@/components/loading-steps";
import { v2VerdictSchema, type V2Verdict } from "@/lib/agents/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { trackEvent } from "@/lib/track-event";
import { useLang } from "@/lib/i18n";
import { encodeVerdict, type ShareableVerdict } from "@/lib/verdict-share";
import { addToHistory, getHistory, clearHistory, type HistoryEntry } from "@/lib/storage";

// ============================================================
// Helpers
// ============================================================

type ViewState = "input" | "loading" | "verdict";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "<1m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const EXAMPLES: Record<"en" | "tr", string[]> = {
  en: [
    "AI tool that reads legal contracts for freelancers",
    "Platform for companies to manage AI agent workforce",
    "SaaS for restaurant inventory management",
    "Chrome extension that detects dark patterns on shopping sites",
    "Marketplace connecting local farmers with restaurants",
    "AI tutor for K-12 math students",
    "Open source alternative to Notion for developers",
    "Subscription box for indie board games",
    "App that tracks and reduces household food waste",
    "Browser-based collaborative design tool for non-designers",
  ],
  tr: [
    "Instagram clone yapmak istiyorum",
    "Freelancerlar için yapay zeka destekli sözleşme analizi",
    "Restoran stok yönetimi için SaaS platformu",
    "Çiftçileri restoranlarla buluşturan pazar yeri",
    "K-12 öğrencileri için yapay zeka matematik koçu",
    "Geliştiriciler için açık kaynak Notion alternatifi",
    "Evdeki gıda israfını takip eden uygulama",
    "Küçük işletmeler için online muhasebe platformu",
    "Evcil hayvan sahipleri için veteriner tele-konsültasyon",
    "Bağımsız oyun geliştiricileri için yayıncılık platformu",
  ],
};

function useTypingPlaceholder(examples: string[], enabled: boolean): string {
  const [text, setText] = useState("");
  const stateRef = useRef({ index: 0, char: 0, phase: "type" as "type" | "delete" | "pause" });

  // Reset animation when examples change (language switch)
  const examplesKey = examples[0] ?? "";
  useEffect(() => {
    stateRef.current = { index: 0, char: 0, phase: "type" };
    setText("");
  }, [examplesKey]);

  useEffect(() => {
    if (!enabled) { setText(""); return }

    let timeout: ReturnType<typeof setTimeout>;

    function tick() {
      const s = stateRef.current;
      const current = examples[s.index];
      if (!current) return;

      if (s.phase === "type") {
        s.char++;
        setText(current.slice(0, s.char));
        if (s.char >= current.length) {
          s.phase = "pause";
          timeout = setTimeout(tick, 2000);
        } else {
          timeout = setTimeout(tick, 60);
        }
      } else if (s.phase === "pause") {
        s.phase = "delete";
        timeout = setTimeout(tick, 30);
      } else if (s.phase === "delete") {
        s.char--;
        setText(current.slice(0, s.char));
        if (s.char <= 0) {
          s.index = (s.index + 1) % examples.length;
          s.phase = "type";
          timeout = setTimeout(tick, 500);
        } else {
          timeout = setTimeout(tick, 30);
        }
      }
    }

    timeout = setTimeout(tick, 500);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, examplesKey]);

  return text;
}

// ============================================================
// Page
// ============================================================

export default function Home() {
  const { lang, t } = useLang();
  const [viewState, setViewState] = useState<ViewState>("input");
  const [idea, setIdea] = useState("");
  const typingPlaceholder = useTypingPlaceholder(EXAMPLES[lang], idea.length === 0);
  const [verdict, setVerdict] = useState<V2Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdictId, setVerdictId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastIdeaRef = useRef<string>("");
  const reEvalEntryRef = useRef<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sessionSubmitted, setSessionSubmitted] = useState(false);

  useEffect(() => { setHistory(getHistory()) }, []);

  const handleSubmit = useCallback(async () => {
    if (!idea.trim() || idea.trim().length < 10 || isLoading) return;

    lastIdeaRef.current = idea.trim();
    setIsLoading(true);
    setError(null);
    setVerdict(null);
    setViewState("loading");

    try {
      const fetchBody: Record<string, unknown> = { idea: idea.trim() };
      if (reEvalEntryRef.current) {
        fetchBody.previousVerdict = {
          idea: reEvalEntryRef.current.idea,
          verdict: reEvalEntryRef.current.verdict,
          confidence: reEvalEntryRef.current.confidence,
          ideaSummary: reEvalEntryRef.current.ideaSummary,
        };
      }

      const res = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fetchBody),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Request failed");

      const result = v2VerdictSchema.safeParse(json.data);
      if (!result.success) throw new Error("Invalid verdict format received");

      setVerdict(result.data);
      setViewState("verdict");
      setSessionSubmitted(true);

      const shorten = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + "…" : s;
      const shareable: ShareableVerdict = {
        v: result.data.verdict,
        s: shorten(result.data.idea_summary, 80),
        c: result.data.confidence.score,
        r: result.data.reasons.map(r => shorten(r.text, 100)).slice(0, 3) as [string, string, string],
        ...(result.data.pivot_suggestion?.suggestion && { p: shorten(result.data.pivot_suggestion.suggestion, 100) }),
      };
      setVerdictId(encodeVerdict(shareable));

      const historyEntry: HistoryEntry = {
        id: encodeVerdict(shareable),
        idea: idea.trim().slice(0, 100),
        verdict: result.data.verdict,
        confidence: result.data.confidence.score,
        ideaSummary: result.data.idea_summary,
        timestamp: Date.now(),
      };
      addToHistory(historyEntry);
      setHistory(getHistory());

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

  const resetAll = () => {
    setIdea("");
    setVerdict(null);
    setVerdictId(null);
    setError(null);
    lastIdeaRef.current = "";
    reEvalEntryRef.current = null;
    setViewState("input");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — minimal */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/20">
        <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
            Council
          </Link>
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
            {viewState !== "input" && (
              <button
                onClick={resetAll}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                title={t("new_idea_tooltip")}
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-6">
        {/* Input */}
        {viewState === "input" && (
          <div className="flex-1 flex flex-col items-center pt-[6vh]">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              {t("hero_h1")}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t("hero_h2")}
            </p>

            {!sessionSubmitted && history.length < 2 && <SampleVerdicts />}

            <div className="w-full max-w-lg">
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div className="rounded-xl border border-border/40 bg-card">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    rows={3}
                    placeholder={typingPlaceholder || t("placeholder")}
                    className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none"
                    disabled={isLoading}
                    autoFocus
                  />
                  <div className="flex items-center justify-end px-3 pb-3">
                    <button
                      type="submit"
                      disabled={isLoading || idea.trim().length < 10}
                      aria-label={t("hero_cta")}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-10 hover:opacity-80 transition-all"
                    >
                      <span>{t("hero_cta")}</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
                  {error}
                  <button onClick={handleSubmit} className="ml-2 underline hover:no-underline">
                    {t("try_again")}
                  </button>
                </div>
              )}

              {/* History */}
              {history.length > 0 && idea.trim().length === 0 && (
                <div className="mt-8 pt-6 border-t border-border/20">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("history_title")}
                    </p>
                    {showClearConfirm ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{t("history_clear_confirm")}</span>
                        <button onClick={() => { clearHistory(); setHistory([]); setShowClearConfirm(false) }} className="text-red-500">✓</button>
                        <button onClick={() => setShowClearConfirm(false)} className="text-muted-foreground">✕</button>
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
                  <div className="space-y-1.5">
                    {history.slice(0, 5).map((entry) => {
                      const color = entry.verdict === "GO"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : entry.verdict === "PIVOT"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400";

                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-muted/40 transition-colors group"
                        >
                          <span className={`text-xs font-semibold ${color} w-12 shrink-0`}>
                            {entry.verdict === "DONT" ? "DON'T" : entry.verdict}
                          </span>
                          <p className="text-sm text-foreground truncate flex-1">{entry.ideaSummary}</p>
                          <span className="text-xs text-muted-foreground/60 shrink-0">{entry.confidence}%</span>
                          <span className="text-xs text-muted-foreground/40 shrink-0 w-8 text-right">{formatTimeAgo(entry.timestamp)}</span>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={`/v/${entry.id}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                              {t("history_view")}
                            </a>
                            <span className="text-muted-foreground/30">·</span>
                            <button onClick={() => handleReEvaluate(entry)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                              {t("history_re_evaluate")}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading — card-based with animations */}
        {viewState === "loading" && (
          <div className="relative flex-1 flex flex-col items-center justify-center px-4">
            <EntropyBg />
            <div className="relative z-10">
              <LoadingSteps active={viewState === "loading"} />
            </div>
          </div>
        )}

        {/* Verdict */}
        {viewState === "verdict" && verdict && (
          <div className="py-8">
            {/* Re-evaluation badge */}
            {reEvalEntryRef.current && (
              <div className="max-w-lg mx-auto mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                  ↻ {t("re_eval_badge")} · {reEvalEntryRef.current.verdict} {reEvalEntryRef.current.confidence}%
                </span>
              </div>
            )}

            {/* Council heard */}
            <div className="max-w-lg mx-auto mb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-1">
                    {t("council_heard")}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed italic">
                    &ldquo;{verdict.idea_summary}&rdquo;
                  </p>
                </div>
                <button
                  onClick={handleNotQuite}
                  className="shrink-0 text-xs text-muted-foreground/60 hover:text-foreground transition-colors whitespace-nowrap mt-4"
                >
                  {t("not_quite")}
                </button>
              </div>
            </div>

            <VerdictCard verdict={verdict} missionId={null} verdictId={verdictId} />

            <div className="mt-6 text-center">
              <button onClick={resetAll} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("try_another")}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer — minimal */}
      <footer className="py-4">
        <div className="max-w-2xl mx-auto px-6 flex items-center justify-center gap-4">
          <a
            href="https://github.com/ivala2081/council"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </a>
          <a
            href="/privacy"
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            Terms
          </a>
        </div>
      </footer>
    </div>
  );
}
