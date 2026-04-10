"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { VerdictCard } from "@/components/verdict-card";
import { v2VerdictSchema, type V2Verdict } from "@/lib/agents/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { trackEvent } from "@/lib/track-event";
import { CouncilMark } from "@/components/council-mark";
import { LoadingDots } from "@/components/loading-dots";

// ============================================================
// State
// ============================================================

type ViewState = "idle" | "input" | "loading" | "verdict";

const LOADING_STEPS = [
  { delay: 0, text: "Reading your idea..." },
  { delay: 3000, text: "Checking the market..." },
  { delay: 8000, text: "Analyzing risks..." },
  { delay: 15000, text: "Building the verdict..." },
  { delay: 25000, text: "Deep analysis — complex ideas take longer..." },
];

const EXAMPLES = [
  { icon: "💡", text: "Instagram clone yapmak istiyorum" },
  { icon: "⚙️", text: "AI tool that reads legal contracts for freelancers" },
  { icon: "🚀", text: "Platform for companies to manage AI agent workforce" },
];

// ============================================================
// Page
// ============================================================

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [idea, setIdea] = useState("");
  const [verdict, setVerdict] = useState<V2Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const lastIdeaRef = useRef<string>("");

  // Idle → input on mount
  useEffect(() => {
    setViewState("input");
  }, []);

  // Loading step timers
  useEffect(() => {
    if (viewState !== "loading") {
      setLoadingStep(0);
      return;
    }
    const timers = LOADING_STEPS.map((step, i) =>
      setTimeout(() => setLoadingStep(i), step.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [viewState]);

  const handleSubmit = useCallback(async () => {
    if (!idea.trim() || idea.trim().length < 10 || isLoading) return;

    lastIdeaRef.current = idea.trim();
    setIsLoading(true);
    setError(null);
    setVerdict(null);
    setViewState("loading");

    try {
      const res = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
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
            <ThemeToggle />
            {(viewState === "verdict" || viewState === "loading") && (
              <button
                onClick={() => {
                  setIdea("");
                  setVerdict(null);
                  setError(null);
                  setViewState("input");
                }}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                title="New idea"
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
        {/* Idle — brief flash before mount */}
        {viewState === "idle" && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingDots />
          </div>
        )}

        {/* Input */}
        {viewState === "input" && (
          <div className="flex-1 flex flex-col items-center pt-[10vh]">
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Fikrine dürüst cevap
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              10 saniye, 3 sebep, acımasızca dürüst.
            </p>

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
                    placeholder="Describe your idea..."
                    className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
                    disabled={isLoading}
                    autoFocus
                  />
                  <div className="flex items-center justify-end px-3 pb-3">
                    <button
                      type="submit"
                      disabled={isLoading || idea.trim().length < 10}
                      className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-15 hover:opacity-80 transition-all"
                    >
                      Dürüst cevap al
                    </button>
                  </div>
                </div>
              </form>

              {/* Landing example chips — only when idea is empty */}
              {idea.trim().length === 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[11px] text-muted-foreground/60 mr-1">Try:</span>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.text}
                      type="button"
                      onClick={() => setIdea(ex.text)}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-border/60 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
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
                    Try again
                  </button>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground/50 text-center mt-4 select-none">
                Enter to send · Shift+Enter for newline
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {viewState === "loading" && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <CouncilMark className="w-8 h-8 text-foreground/60 mb-6 animate-pulse" />
            <div className="space-y-2 text-sm">
              {LOADING_STEPS.slice(0, loadingStep + 1).map((step, i) => (
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
          </div>
        )}

        {/* Verdict */}
        {viewState === "verdict" && verdict && (
          <div className="py-8">
            {/* Council heard header */}
            <div className="max-w-xl mx-auto mb-4 px-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                Council heard
              </p>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground leading-relaxed italic">
                  &ldquo;{verdict.idea_summary}&rdquo;
                </p>
                <button
                  onClick={handleNotQuite}
                  className="shrink-0 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Not quite?
                </button>
              </div>
            </div>

            <VerdictCard verdict={verdict} missionId={null} />

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIdea("");
                  setVerdict(null);
                  setError(null);
                  lastIdeaRef.current = "";
                  setViewState("input");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Try another idea
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
