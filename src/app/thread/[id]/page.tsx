"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BriefView } from "@/components/brief-view";
import { ConciseBriefView } from "@/components/concise-brief-view";
import { CouncilMark } from "@/components/council-mark";
import { DeltaBanner } from "@/components/delta-banner";
import { FeedbackForm } from "@/components/feedback-form";
import { LoadingDots } from "@/components/loading-dots";
import { PdfExportButton } from "@/components/pdf-export-button";
import { ThreadSectionNav } from "@/components/thread-section-nav";
import { GenesisView } from "@/components/genesis/genesis-view";
import { VerdictActionBar } from "@/components/verdict-action-bar";
import { ScoreSparkline } from "@/components/score-sparkline";
import { ShareModal } from "@/components/share-modal";
import { EmailCapture } from "@/components/email-capture";
import {
  strategicBriefSchema,
  conciseBriefSchema,
  type StrategicBrief,
  type ConciseBrief,
} from "@/lib/agents/types";
import { getVerdict, getDelta } from "@/lib/design-tokens";
import type { BriefDelta } from "@/lib/threads/delta";
import { trackEvent } from "@/lib/track-event";
import { canStartGenesis } from "@/lib/entitlements";

type BriefMode = "full" | "concise";

const UPDATE_CHIPS = [
  { id: "traction", label: "Got traction", prefix: "Traction update: " },
  { id: "pricing", label: "Changed pricing", prefix: "Pricing change: " },
  { id: "pivot", label: "Pivoted ICP", prefix: "ICP pivot: " },
  { id: "competitor", label: "New competitor", prefix: "Competitive update: " },
  { id: "funding", label: "Got funding", prefix: "Funding update: " },
  { id: "feedback", label: "User feedback", prefix: "User feedback: " },
  { id: "tech", label: "Tech blocker", prefix: "Technical update: " },
] as const;

interface Run {
  id: string;
  prompt: string;
  status: string;
  result: Record<string, unknown> | null;
  delta: BriefDelta | null;
  run_number: number;
  pipeline_mode: string;
  created_at: string;
  completed_at: string | null;
}

interface Thread {
  id: string;
  name: string;
  latest_verdict: string | null;
  latest_score: number | null;
  run_count: number;
  created_at: string;
}

// Genesis project state
interface Project {
  id: string;
  status: string;
  current_phase: number;
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);

  // New run state
  const [prompt, setPrompt] = useState("");
  const [completion, setCompletion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newMissionId, setNewMissionId] = useState<string | null>(null);
  const [mode, setMode] = useState<BriefMode>("full");
  const [copiedShare, setCopiedShare] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(false);
  const briefRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ownerToken = typeof window !== "undefined"
    ? localStorage.getItem("council_owner_token") ?? ""
    : "";

  // Fetch thread data
  useEffect(() => {
    const token = localStorage.getItem("council_owner_token") ?? "";
    fetch(`/api/threads/${id}?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        setThread(data.thread);
        setRuns(data.runs ?? []);
        if (data.thread) {
          trackEvent({
            event: "thread_viewed",
            thread_id: id,
            run_number: data.thread.run_count,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Check for existing project (genesis)
  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("council_owner_token") ?? "";
    fetch(`/api/projects?owner_token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        const projects = data.projects ?? [];
        const existing = projects.find(
          (p: { thread_id: string }) => p.thread_id === id
        );
        if (existing) setProject(existing);
      })
      .catch(() => {});
  }, [id]);

  // Parse new brief from streaming completion
  const parsedBrief = useMemo<StrategicBrief | null>(() => {
    if (!completion || isStreaming || mode !== "full") return null;
    try {
      const cleaned = completion.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.executiveSummary && !parsed.verdict) parsed.verdict = parsed.executiveSummary;
      const result = strategicBriefSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }, [completion, isStreaming, mode]);

  const parsedConciseBrief = useMemo<ConciseBrief | null>(() => {
    if (!completion || isStreaming || mode !== "concise") return null;
    try {
      const cleaned = completion.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.executiveSummary && !parsed.verdict) parsed.verdict = parsed.executiveSummary;
      const result = conciseBriefSchema.safeParse(parsed);
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }, [completion, isStreaming, mode]);

  const newBrief = parsedBrief || parsedConciseBrief;
  const [newRunDelta, setNewRunDelta] = useState<BriefDelta | null>(null);

  // After brief completes, re-fetch thread to get delta
  useEffect(() => {
    if (newBrief && briefRef.current) {
      briefRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (newBrief && newMissionId) {
      const token = localStorage.getItem("council_owner_token") ?? "";
      fetch(`/api/threads/${id}?token=${token}`)
        .then((r) => r.json())
        .then((data) => {
          setThread(data.thread);
          const allRuns = (data.runs ?? []) as Run[];
          setRuns(allRuns);
          const newRun = allRuns.find((r: Run) => r.id === newMissionId);
          if (newRun?.delta) {
            setNewRunDelta(newRun.delta);
            trackEvent({
              event: "delta_banner_viewed",
              thread_id: id,
              mission_id: newMissionId,
              score_delta: newRun.delta.scoreDelta,
              verdict: newRun.delta.verdictChange?.to,
            });
          }
        })
        .catch(() => {});
    }
  }, [newBrief, newMissionId, id]);

  // Submit new run
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isStreaming) return;

      setCompletion("");
      setError(null);
      setNewMissionId(null);
      setIsStreaming(true);

      try {
        const token = localStorage.getItem("council_owner_token") ?? undefined;
        const res = await fetch("/api/mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, mode, threadId: id, ownerToken: token }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Request failed");
        }

        const mid = res.headers.get("X-Mission-Id");
        if (mid) {
          setNewMissionId(mid);
          if (runs.length > 0) {
            trackEvent({
              event: "second_run_submitted",
              thread_id: id,
              mission_id: mid,
              run_number: runs.length + 1,
            });
          }
        }

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
        setIsStreaming(false);
      }
    },
    [prompt, isStreaming, mode, id, runs.length]
  );

  const handleStartGenesis = useCallback(async () => {
    if (!thread || building) return;
    if (!canStartGenesis(ownerToken)) return;

    setBuilding(true);
    try {
      const token = localStorage.getItem("council_owner_token") ?? "";
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, ownerToken: token, name: thread.name }),
      });
      const json = await res.json();
      if (json.projectId) {
        setProject({ id: json.projectId, status: "pending", current_phase: 0 });
        // Start build
        await fetch(`/api/projects/${json.projectId}/build`, { method: "POST" });
        setProject((p) => p ? { ...p, status: "building" } : p);
      } else {
        setError(json.error ?? "Failed to create project");
      }
    } catch {
      setError("Failed to start Genesis");
    } finally {
      setBuilding(false);
    }
  }, [thread, building, ownerToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim().length >= 10 && !isStreaming) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  const lastRun = runs.filter((r) => r.status === "completed").at(-1) ?? null;
  const lastVerdict = lastRun?.result?.verdict as Record<string, unknown> | undefined;
  const hasGenesis = project !== null;
  const hasCompletedRun = runs.some((r) => r.status === "completed");

  // Section nav
  const sections = [
    { id: "header", label: "Overview", visible: true },
    { id: "runs", label: "Runs", visible: runs.length > 0 },
    { id: "brief", label: "Brief", visible: !!newBrief || !!lastRun },
    { id: "update-input", label: "Update", visible: !newBrief && !isStreaming },
    { id: "genesis", label: "Genesis", visible: hasGenesis },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading<LoadingDots /></p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Thread not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <ThreadSectionNav sections={sections} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-6">
        {/* ─── SECTION: Header ─── */}
        <section id="header" className="mb-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold line-clamp-2">{thread.name}</h1>
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <button
                onClick={() => setShareOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Share
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {thread.latest_verdict && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getVerdict(thread.latest_verdict).bg} ${getVerdict(thread.latest_verdict).text}`}>
                {thread.latest_verdict.toUpperCase()}
              </span>
            )}
            {thread.latest_score !== null && (
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {thread.latest_score}
              </span>
            )}
            <ScoreSparkline
              scores={runs
                .filter((r) => r.status === "completed")
                .map((r) => {
                  const v = r.result?.verdict as Record<string, unknown> | undefined;
                  return (v?.councilScore as number) ?? 0;
                })
                .filter((s) => s > 0)}
              latestVerdict={thread.latest_verdict ?? undefined}
            />
            <span className="text-xs text-muted-foreground">
              · {thread.run_count} {thread.run_count === 1 ? "run" : "runs"}
            </span>
          </div>
        </section>

        {/* ─── SECTION: Run History ─── */}
        {runs.length > 0 && (
          <section id="runs" className="mb-8 space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Run History
            </h2>
            {runs.filter((r) => r.status === "completed").map((run) => {
              const v = run.result?.verdict as Record<string, unknown> | undefined;
              const verdict = v?.verdict as string | undefined;
              const score = v?.councilScore as number | undefined;
              const vc = verdict ? getVerdict(verdict) : null;
              const d = run.delta;
              return (
                <a key={run.id} href={`/brief/${run.id}`} className="block group">
                  <div className="px-4 py-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground shrink-0">
                        Run {run.run_number}
                      </span>
                      <p className="text-sm line-clamp-1 flex-1 min-w-0">{run.prompt}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {d && d.scoreDelta !== 0 && (
                          <span className={`text-[11px] font-semibold tabular-nums ${getDelta(d.scoreDelta).text}`}>
                            {d.scoreDelta > 0 ? "+" : ""}{d.scoreDelta}
                          </span>
                        )}
                        {vc && verdict && (
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${vc.bg} ${vc.text}`}>
                            {verdict.toUpperCase()}
                          </span>
                        )}
                        {score !== undefined && (
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{score}</span>
                        )}
                      </div>
                    </div>
                    {d?.verdictChange && (
                      <div className="mt-1 flex items-center gap-1.5 ml-10">
                        <span className={`text-[10px] ${getVerdict(d.verdictChange.from).text}`}>
                          {d.verdictChange.from}
                        </span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className={`text-[10px] ${getVerdict(d.verdictChange.to).text}`}>
                          {d.verdictChange.to}
                        </span>
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </section>
        )}

        {/* ─── SECTION: Brief (latest or new) ─── */}
        <section id="brief" ref={briefRef}>
          {/* Streaming state */}
          {isStreaming && (
            <div className="py-6 flex items-start gap-3.5 animate-fade-up">
              <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center shrink-0">
                <CouncilMark className="w-4 h-4 text-foreground" />
              </div>
              <div className="pt-1.5">
                <p className="text-[15px] text-muted-foreground">
                  {lastRun ? "Reassessing with your updates" : "Analyzing your idea"}
                  <LoadingDots />
                </p>
              </div>
            </div>
          )}

          {/* New brief result */}
          {newBrief && !isStreaming && (
            <div className="py-4 animate-in fade-in duration-300 mb-8">
              {newRunDelta && <DeltaBanner delta={newRunDelta} />}
              {parsedBrief && <BriefView brief={parsedBrief} />}
              {parsedConciseBrief && <ConciseBriefView brief={parsedConciseBrief} />}

              <div className="mt-4 flex justify-end">
                <PdfExportButton
                  briefRef={briefRef}
                  filename={`council-${thread.name.slice(0, 30).replace(/\s+/g, "-").toLowerCase()}.pdf`}
                  title={thread.name}
                  variant="button"
                />
              </div>

              {/* Verdict Action Bar */}
              {hasCompletedRun && !hasGenesis && thread.latest_verdict && (
                <div className="mt-6">
                  <VerdictActionBar
                    verdict={thread.latest_verdict}
                    onGenesis={handleStartGenesis}
                    building={building}
                  />
                </div>
              )}

              {newMissionId && (
                <div className="mt-6">
                  <FeedbackForm missionId={newMissionId} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* ─── SECTION: Update Input ─── */}
        {!newBrief && !isStreaming && (
          <section id="update-input" className="mb-8">
            {/* Sprint status */}
            {lastRun && (() => {
              const daysSince = Math.floor((Date.now() - new Date(lastRun.created_at).getTime()) / 86400000);
              const sprintMsg =
                daysSince <= 2 ? "Your sprint just started. Come back when you have early results."
                : daysSince <= 5 ? "Mid-sprint — any traction, feedback, or changes to report?"
                : daysSince <= 7 ? "Sprint ending soon. Update Council with what you learned."
                : `Sprint expired ${daysSince - 7} day${daysSince - 7 === 1 ? "" : "s"} ago. What happened?`;
              return (
                <p className={`text-xs mb-3 px-1 ${daysSince > 7 ? "text-status-warning" : "text-muted-foreground"}`}>
                  {sprintMsg}
                </p>
              );
            })()}

            {/* Update chips */}
            {lastRun && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {UPDATE_CHIPS.map((chip) => {
                  const active = selectedChips.has(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => {
                        const next = new Set(selectedChips);
                        if (active) {
                          next.delete(chip.id);
                          setPrompt((p) => p.replace(chip.prefix, "").trim());
                        } else {
                          next.add(chip.id);
                          setPrompt((p) => (p ? `${chip.prefix}\n${p}` : chip.prefix));
                        }
                        setSelectedChips(next);
                        textareaRef.current?.focus();
                      }}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                        active
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="relative rounded-2xl border border-border/60 bg-card focus-within:border-border transition-colors">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  placeholder={lastRun ? "Describe what changed..." : "Describe your idea..."}
                  className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
                  disabled={isStreaming}
                  autoFocus
                />
                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                  <div className="flex items-center rounded-lg bg-muted/60 p-0.5">
                    <button
                      type="button"
                      onClick={() => setMode("full")}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                        mode === "full" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Full Brief
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("concise")}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                        mode === "concise" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Decisions Only
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={isStreaming || prompt.length < 10}
                    className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center disabled:opacity-20 hover:opacity-80 transition-opacity"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </form>

            {lastVerdict && (
              <p className="text-[11px] text-muted-foreground/40 text-center mt-2 select-none">
                Last verdict: {(lastVerdict.verdict as string)?.toUpperCase()} ({lastVerdict.councilScore as number}) · Tell Council what&apos;s different now
              </p>
            )}

            {/* Verdict Action Bar */}
            {hasCompletedRun && !hasGenesis && !newBrief && thread.latest_verdict && (
              <div className="mt-6">
                <VerdictActionBar
                  verdict={thread.latest_verdict}
                  onGenesis={handleStartGenesis}
                  building={building}
                />
              </div>
            )}
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border bg-card">
            <CouncilMark className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ─── Email Capture ─── */}
        {hasCompletedRun && (
          <section className="mb-8">
            <EmailCapture ownerToken={ownerToken} />
          </section>
        )}

        {/* ─── GENESIS DIVIDER ─── */}
        {hasGenesis && (
          <>
            <div className="my-12 flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Genesis
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* ─── SECTION: Genesis ─── */}
            <section id="genesis" className="mb-8">
              {project && <GenesisView projectId={project.id} />}
            </section>
          </>
        )}
      </main>

      {/* Share Modal */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        threadId={thread.id}
        threadName={thread.name}
        latestMissionId={lastRun?.id ?? null}
        runCount={runs.filter((r) => r.status === "completed").length}
        hasGenesis={hasGenesis}
      />
    </div>
  );
}
