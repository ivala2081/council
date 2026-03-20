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
import { getVerdict } from "@/lib/design-tokens";

type BriefMode = "full" | "concise" | "deep";
type Lang = "en" | "tr";

const HINTS: Record<Lang, string[]> = {
  en: [
    "Describe your idea and team",
    "What problem are you solving?",
    "Who are your first 100 customers?",
    "We got 50 users, should we pivot to B2B?",
  ],
  tr: [
    "Fikrinizi ve ekibinizi anlatın",
    "Hangi problemi çözüyorsunuz?",
    "İlk 100 müşteriniz kim olacak?",
    "50 kullanıcı aldık, B2B'ye dönmeli miyiz?",
  ],
};

function TypewriterHint({ lang }: { lang: Lang }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "waiting" | "erasing">("typing");
  const hints = HINTS[lang];

  useEffect(() => {
    setIndex(0);
    setPhase("typing");
  }, [lang]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === "typing") {
      timer = setTimeout(() => setPhase("waiting"), 1400);
    } else if (phase === "waiting") {
      timer = setTimeout(() => setPhase("erasing"), 2200);
    } else {
      timer = setTimeout(() => {
        setIndex((i) => (i + 1) % hints.length);
        setPhase("typing");
      }, 500);
    }

    return () => clearTimeout(timer);
  }, [phase, hints.length]);

  return (
    <span
      key={`${lang}-${index}`}
      className={`text-muted-foreground/40 ${phase === "erasing" ? "typewriter-exit" : "typewriter-text"}`}
    >
      {hints[index]}
    </span>
  );
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

interface ThreadSummary {
  id: string;
  name: string;
  latest_verdict: string | null;
  latest_score: number | null;
  run_count: number;
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

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [completion, setCompletion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [mode, setMode] = useState<BriefMode>("full");
  const [lang, setLang] = useState<Lang>("en");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const briefRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch threads on mount
  useEffect(() => {
    const token = getOwnerToken();
    if (!token) return;
    fetch(`/api/threads?token=${token}`)
      .then((r) => r.json())
      .then((data) => setThreads(data.threads ?? []))
      .catch(() => {});
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
    if (hasBrief && briefRef.current) {
      briefRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hasBrief]);

  // Track brief_generated event
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

  useEffect(() => {
    if (hasBrief && missionId) {
      try {
        const stored = localStorage.getItem("council_missions");
        const ids: string[] = stored ? JSON.parse(stored) : [];
        if (!ids.includes(missionId)) {
          ids.unshift(missionId);
          localStorage.setItem("council_missions", JSON.stringify(ids.slice(0, 50)));
        }
      } catch {}
    }
  }, [hasBrief, missionId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isLoading) return;

      setCompletion("");
      setError(null);
      setMissionId(null);
      setIsLoading(true);

      try {
        const ownerToken = getOwnerToken();
        const res = await fetch("/api/mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
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
        let text = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setCompletion(text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [prompt, isLoading, mode]
  );

  const handleNewMission = () => {
    setPrompt("");
    setCompletion("");
    setError(null);
    setMissionId(null);
    setThreadId(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim().length >= 10 && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const showInput = !hasBrief && !isLoading;

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
            {/* Language toggle */}
            <div className="flex items-center rounded-md bg-muted/60 p-0.5 mr-1">
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                  lang === "en"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("tr")}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                  lang === "tr"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                TR
              </button>
            </div>
            <ThemeToggle />
            <a
              href="/projects"
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
              title="Projects"
            >
              <svg className="w-[18px] h-[18px] text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </a>
            <a
              href="/history"
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
              title="History"
            >
              <svg className="w-[18px] h-[18px] text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
            {hasBrief && !isLoading && (
              <button
                onClick={handleNewMission}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                title="New mission"
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
        {/* Input area */}
        {showInput && (
          <div className="flex-1 flex flex-col items-center justify-center -mt-14">
            {/* Title */}
            <div className="mb-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-card border border-border/50 flex items-center justify-center mx-auto mb-6 shadow-sm">
                <CouncilMark className="w-7 h-7 text-foreground/80" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gradient">
                {lang === "tr" ? "Ne inşa ediyorsun?" : "What are you building?"}
              </h1>
              <p className="text-[15px] text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
                {lang === "tr"
                  ? "Fikrinizi değerlendirin. Geri gelin, ne değiştiğini söyleyin — Council hatırlar."
                  : "Get a strategic verdict. Come back with updates — Council remembers."}
              </p>
            </div>

            {/* Input box */}
            <div className="w-full max-w-[640px]">
              <form onSubmit={handleSubmit}>
                <div className="input-glow relative rounded-2xl border border-border/60 bg-card shadow-sm">
                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-transparent focus:outline-none"
                    disabled={isLoading}
                    autoFocus
                  />

                  {/* Typewriter hint */}
                  {!prompt && (
                    <div className="absolute top-4 left-4 text-[15px] pointer-events-none">
                      <TypewriterHint lang={lang} />
                    </div>
                  )}

                  {/* Bottom toolbar */}
                  <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    <div className="flex items-center gap-2">
                      {/* Mode toggle */}
                      <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
                        <button
                          type="button"
                          onClick={() => setMode("full")}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                            mode === "full"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {lang === "tr" ? "Tam Rapor" : "Full Brief"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode("concise")}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                            mode === "concise"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {lang === "tr" ? "Kararlar" : "Decisions Only"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode("deep")}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${
                            mode === "deep"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          title={lang === "tr" ? "Extended Thinking — daha derin analiz, biraz daha yavaş" : "Extended Thinking — deeper analysis, slightly slower"}
                        >
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                          </svg>
                          {lang === "tr" ? "Derin" : "Deep"}
                        </button>
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={isLoading || prompt.length < 10}
                      className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center disabled:opacity-15 hover:opacity-80 transition-all hover:scale-105 active:scale-95"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>

              <p className="text-[11px] text-muted-foreground/50 text-center mt-4 select-none">
                {lang === "tr"
                  ? "Enter gönder · Skor, riskler, 7 günlük sprint alacaksınız"
                  : "Enter to send · You'll get a score, risks, and a 7-day sprint"}
              </p>
              <p className="text-center mt-1">
                <a href="/how-we-score" className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground underline underline-offset-2 decoration-muted-foreground/20 hover:decoration-muted-foreground/50 transition-all">
                  {lang === "tr" ? "Nasıl puanlıyoruz?" : "How we score"}
                </a>
              </p>

              {/* Recent threads */}
              {threads.length > 0 && (
                <div className="mt-10 pt-6 border-t border-border/30">
                  <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    {lang === "tr" ? "Devam et" : "Continue where you left off"}
                  </p>
                  <div className="space-y-2">
                    {threads.slice(0, 5).map((t) => {
                      const vc = t.latest_verdict ? getVerdict(t.latest_verdict) : null;
                      return (
                        <a
                          key={t.id}
                          href={`/thread/${t.id}`}
                          className="card-hover flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card hover:bg-muted/20 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-1 group-hover:text-foreground transition-colors">{t.name}</p>
                            <span className="text-[11px] text-muted-foreground">
                              {t.run_count} {t.run_count === 1 ? "run" : "runs"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {vc && t.latest_verdict && (
                              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${vc.bg} ${vc.text}`}>
                                {t.latest_verdict.toUpperCase()}
                              </span>
                            )}
                            {t.latest_score !== null && (
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{t.latest_score}</span>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="my-6 px-4 py-3 rounded-xl bg-status-error/10 text-sm text-status-error">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="py-12 flex items-start gap-4 max-w-2xl animate-fade-up">
            <div className="w-10 h-10 rounded-xl bg-card border border-border/50 flex items-center justify-center shrink-0 shadow-sm">
              <CouncilMark className="w-5 h-5 text-foreground/80" />
            </div>
            <div className="pt-1.5">
              <p className="text-[15px] text-muted-foreground">
                {lang === "tr"
                  ? mode === "concise"
                    ? "Karar raporu hazırlanıyor"
                    : mode === "deep"
                    ? "Derin analiz yapılıyor — biraz daha sürebilir"
                    : "Fikriniz analiz ediliyor"
                  : mode === "concise"
                  ? "Generating decision brief"
                  : mode === "deep"
                  ? "Deep analysis in progress — this may take a moment"
                  : "Analyzing your idea"}
                <LoadingDots />
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        <div ref={briefRef}>
          {parsedBrief && !isLoading && (
            <div className="py-8 animate-in fade-in duration-300">
              <BriefView brief={parsedBrief} />
              {missionId && <ShareBar missionId={missionId} />}
              {threadId && (
                <div className="mt-4">
                  <a
                    href={`/thread/${threadId}`}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    {lang === "tr" ? "7 günlük sprint başladı. Gelişme olunca geri gel." : "Your 7-day sprint starts now. Return when something changes."}
                  </a>
                  <p className="text-[11px] text-muted-foreground/40 text-center mt-1.5 select-none">
                    {lang === "tr" ? "Council thread'inizi hatırlar ve ilerlemenizi takip eder." : "Council remembers your thread and tracks progress over time."}
                  </p>
                </div>
              )}
              <div className="mt-6">
                <FeedbackForm missionId={missionId} />
              </div>
            </div>
          )}

          {parsedConciseBrief && !isLoading && (
            <div className="py-8 animate-in fade-in duration-300">
              <ConciseBriefView brief={parsedConciseBrief} />
              {missionId && <ShareBar missionId={missionId} />}
              {threadId && (
                <div className="mt-4">
                  <a
                    href={`/thread/${threadId}`}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    {lang === "tr" ? "7 günlük sprint başladı. Gelişme olunca geri gel." : "Your 7-day sprint starts now. Return when something changes."}
                  </a>
                  <p className="text-[11px] text-muted-foreground/40 text-center mt-1.5 select-none">
                    {lang === "tr" ? "Council thread'inizi hatırlar ve ilerlemenizi takip eder." : "Council remembers your thread and tracks progress over time."}
                  </p>
                </div>
              )}
              <div className="mt-6">
                <FeedbackForm missionId={missionId} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
