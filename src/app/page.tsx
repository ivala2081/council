"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { BriefView } from "@/components/brief-view";
import { ConciseBriefView } from "@/components/concise-brief-view";
import { FeedbackForm } from "@/components/feedback-form";
import {
  strategicBriefSchema,
  conciseBriefSchema,
  type StrategicBrief,
  type ConciseBrief,
} from "@/lib/agents/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { trackEvent } from "@/lib/track-event";
import { CouncilMark } from "@/components/council-mark";
import { LoadingDots } from "@/components/loading-dots";
import { CouncilConversation } from "@/components/council-conversation";
import { CouncilGreeting } from "@/components/council-greeting";
import type { IntakeContext } from "@/lib/intake/conversation-engine";
import { CompareModal } from "@/components/compare-modal";
import { ShortcutHint } from "@/components/shortcut-hint";

type BriefMode = "full" | "concise" | "deep";

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
  let token = localStorage.getItem("council_owner_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("council_owner_token", token);
  }
  return token;
}

function ShareBar({ missionId }: { missionId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/brief/${missionId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      trackEvent({ event: "share_clicked", mission_id: missionId });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-8 flex items-center gap-3 py-3 px-4 bg-muted/40 rounded-xl">
      <code className="text-xs text-muted-foreground truncate flex-1">{url}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

type ViewState = "loading" | "intake" | "greeting" | "classic" | "analyzing" | "brief";

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [prompt, setPrompt] = useState("");
  const [completion, setCompletion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [mode, setMode] = useState<BriefMode>("full");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const briefRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine initial view
  useEffect(() => {
    const token = getOwnerToken();
    fetch(`/api/threads?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        const t = data.threads ?? [];
        setThreads(t);
        setViewState(t.length > 0 ? "greeting" : "intake");
      })
      .catch(() => setViewState("intake"));
  }, []);

  const parsedBrief = useMemo<StrategicBrief | null>(() => {
    if (!completion || isLoading || (mode !== "full" && mode !== "deep")) return null;
    try {
      const cleaned = completion.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.executiveSummary && !parsed.verdict) parsed.verdict = parsed.executiveSummary;
      const result = strategicBriefSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }, [completion, isLoading, mode]);

  const parsedConciseBrief = useMemo<ConciseBrief | null>(() => {
    if (!completion || isLoading || mode !== "concise") return null;
    try {
      const cleaned = completion.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.executiveSummary && !parsed.verdict) parsed.verdict = parsed.executiveSummary;
      const result = conciseBriefSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }, [completion, isLoading, mode]);

  const hasBrief = parsedBrief || parsedConciseBrief;

  useEffect(() => {
    if (hasBrief) {
      setViewState("brief");
      briefRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hasBrief]);

  useEffect(() => {
    if (hasBrief && missionId) {
      const brief = parsedBrief || parsedConciseBrief;
      const v = brief?.verdict;
      trackEvent({
        event: "brief_generated",
        thread_id: threadId ?? undefined,
        mission_id: missionId,
        run_number: 1,
        verdict: v?.verdict,
        score: v?.councilScore,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBrief, missionId]);

  const submitToMission = useCallback(
    async (text: string) => {
      setCompletion("");
      setError(null);
      setMissionId(null);
      setIsLoading(true);
      setViewState("analyzing");

      try {
        const ownerToken = getOwnerToken();
        const res = await fetch("/api/mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            mode: mode === "deep" ? "deep" : mode,
            ownerToken,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Request failed");
        }

        const id = res.headers.get("X-Mission-Id");
        if (id) setMissionId(id);
        const tid = res.headers.get("X-Thread-Id");
        if (tid) setThreadId(tid);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setCompletion(fullText);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setViewState("classic");
      } finally {
        setIsLoading(false);
      }
    },
    [mode]
  );

  const handleIntakeComplete = useCallback(
    (_ctx: IntakeContext, compiledPrompt: string) => {
      setPrompt(compiledPrompt);
      submitToMission(compiledPrompt);
    },
    [submitToMission]
  );

  const handleClassicSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isLoading) return;
      submitToMission(prompt);
    },
    [prompt, isLoading, submitToMission]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim().length >= 10 && !isLoading) {
        handleClassicSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const handleNewMission = () => {
    setPrompt("");
    setCompletion("");
    setError(null);
    setMissionId(null);
    setThreadId(null);
    setViewState("intake");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <CouncilMark className="w-5 h-5 text-foreground transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-semibold tracking-tight">Council</span>
          </a>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {(viewState === "brief" || viewState === "analyzing") && (
              <button
                onClick={handleNewMission}
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
        {/* Loading initial state */}
        {viewState === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingDots />
          </div>
        )}

        {/* New user: Conversational intake */}
        {viewState === "intake" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="mb-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-card border border-border/50 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <CouncilMark className="w-7 h-7 text-foreground/80" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gradient">
                What are you building?
              </h1>
              <p className="text-[15px] text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                Council is your strategic co-founder. Let&apos;s start with a conversation.
              </p>
            </div>

            <CouncilConversation
              onComplete={handleIntakeComplete}
              onSkip={() => setViewState("classic")}
            />
          </div>
        )}

        {/* Returning user: Greeting + thread list */}
        {viewState === "greeting" && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="mb-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-card border border-border/50 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <CouncilMark className="w-7 h-7 text-foreground/80" />
              </div>
            </div>

            <CouncilGreeting
              threads={threads}
              onNewIdea={() => setViewState("intake")}
            />
            {threads.length >= 2 && (
              <button
                onClick={() => setCompareOpen(true)}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-2"
              >
                Compare ideas
              </button>
            )}
          </div>
        )}

        {/* Classic textarea (skip mode) */}
        {viewState === "classic" && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-14">
            <div className="mb-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-card border border-border/50 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <CouncilMark className="w-7 h-7 text-foreground/80" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gradient">
                Describe your idea
              </h1>
              <p className="text-[15px] text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                Tell Council about your startup — team, problem, market, traction.
              </p>
            </div>

            <div className="w-full max-w-[640px]">
              <form onSubmit={handleClassicSubmit}>
                <div className="input-glow relative rounded-2xl border border-border/60 bg-card shadow-sm">
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={4}
                    placeholder="Describe your idea, team, and what problem you're solving..."
                    className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
                    disabled={isLoading}
                    autoFocus
                  />
                  <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
                      {(["full", "concise", "deep"] as BriefMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                            mode === m
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {m === "full" ? "Full Brief" : m === "concise" ? "Decisions Only" : "Deep"}
                        </button>
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading || prompt.length < 10}
                      className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center disabled:opacity-15 hover:opacity-80 transition-all"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>

              <p className="text-[11px] text-muted-foreground/50 text-center mt-4 select-none">
                Enter to send
              </p>

              <button
                onClick={() => setViewState(threads.length > 0 ? "greeting" : "intake")}
                className="block mx-auto mt-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Back to conversation
              </button>
            </div>
          </div>
        )}

        {/* Analyzing state */}
        {viewState === "analyzing" && isLoading && (
          <div className="py-12 flex items-start gap-4 max-w-2xl animate-fade-up">
            <div className="w-10 h-10 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0 shadow-sm">
              <CouncilMark className="w-5 h-5 text-foreground/80" />
            </div>
            <div className="pt-1.5">
              <p className="text-[15px] text-muted-foreground">
                {mode === "concise"
                  ? "Generating decision brief"
                  : mode === "deep"
                  ? "Deep analysis in progress — this may take a moment"
                  : "Analyzing your idea"}
                <LoadingDots />
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="my-6 flex flex-col items-center gap-3">
            <div className="px-4 py-3 rounded-xl border bg-card text-sm text-foreground flex items-center gap-3">
              <CouncilMark className="w-5 h-5 shrink-0" />
              <span>Council hit a snag. Let&apos;s try again.</span>
            </div>
            <button
              onClick={() => {
                setError(null);
                if (prompt) submitToMission(prompt);
              }}
              className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity"
            >
              Try again
            </button>
          </div>
        )}

        {/* Brief results */}
        <div ref={briefRef}>
          {parsedBrief && !isLoading && viewState === "brief" && (
            <div className="py-8 animate-in fade-in duration-300">
              <BriefView brief={parsedBrief} />
              {missionId && <ShareBar missionId={missionId} />}
              {threadId && (
                <div className="mt-4">
                  <a
                    href={`/thread/${threadId}`}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors text-sm"
                  >
                    Go to thread — see your sprint plan
                  </a>
                </div>
              )}
              <div className="mt-6">
                <FeedbackForm missionId={missionId} />
              </div>
            </div>
          )}

          {parsedConciseBrief && !isLoading && viewState === "brief" && (
            <div className="py-8 animate-in fade-in duration-300">
              <ConciseBriefView brief={parsedConciseBrief} />
              {missionId && <ShareBar missionId={missionId} />}
              {threadId && (
                <div className="mt-4">
                  <a
                    href={`/thread/${threadId}`}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors text-sm"
                  >
                    Go to thread — see your sprint plan
                  </a>
                </div>
              )}
              <div className="mt-6">
                <FeedbackForm missionId={missionId} />
              </div>
            </div>
          )}
        </div>
      </main>

      <CompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        threads={threads}
      />
      <ShortcutHint />
    </div>
  );
}
