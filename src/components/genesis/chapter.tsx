"use client";

import { useState } from "react";
import type { Chapter } from "@/lib/genesis/narrative-builder";

const STATUS_ICONS: Record<string, { icon: string; className: string }> = {
  completed: { icon: "check", className: "text-status-success bg-status-success/10" },
  running: { icon: "pulse", className: "text-status-info bg-status-info/10 genesis-pulse" },
  pending: { icon: "circle", className: "text-muted-foreground bg-muted/50" },
  failed: { icon: "x", className: "text-status-error bg-status-error/10" },
  skipped: { icon: "minus", className: "text-muted-foreground/50 bg-muted/30" },
};

export function ChapterView({
  chapter,
  isActive,
}: {
  chapter: Chapter;
  isActive: boolean;
}) {
  const [expanded, setExpanded] = useState(isActive || chapter.status === "running");
  const status = STATUS_ICONS[chapter.status] ?? STATUS_ICONS.pending;

  return (
    <div
      data-slot="chapter"
      className={`relative pl-8 ${chapter.status === "skipped" ? "opacity-50" : ""}`}
    >
      {/* Status dot */}
      <div
        className={`absolute left-0 top-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold ${status.className} ${
          chapter.status === "running" ? "animate-pulse-dot" : ""
        }`}
      >
        {chapter.status === "completed" && (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
        {chapter.status === "running" && (
          <div className="w-2 h-2 rounded-full bg-current" />
        )}
        {chapter.status === "pending" && (
          <div className="w-2 h-2 rounded-full border border-current" />
        )}
        {chapter.status === "failed" && (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        )}
        {chapter.status === "skipped" && (
          <div className="w-2.5 h-px bg-current" />
        )}
      </div>

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Chapter {chapter.number}
        </span>
        <span className="text-sm font-medium text-foreground group-hover:text-foreground/80 transition-colors">
          {chapter.name}
        </span>
        {chapter.status === "skipped" && (
          <span className="text-[10px] text-muted-foreground">(Skipped)</span>
        )}
        <svg
          className={`w-3 h-3 ml-auto text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Narrative entries */}
      {expanded && chapter.narratives.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5 pl-2 border-l border-border/50 ml-1">
          {chapter.narratives.map((entry, i) => (
            <div key={i} className="pl-3 animate-fade-up">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">{entry.headline}</p>
                  {entry.reasoning && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {entry.reasoning}
                    </p>
                  )}
                  {entry.artifacts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {entry.artifacts.map((a, j) => (
                        <span
                          key={j}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono"
                        >
                          {a.split("/").pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Running indicator */}
      {chapter.status === "running" && chapter.narratives.length === 0 && expanded && (
        <div className="mt-3 pl-5">
          <p className="text-xs text-muted-foreground animate-pulse">
            Working...
          </p>
        </div>
      )}

      {/* Error */}
      {chapter.status === "failed" && chapter.error && expanded && (
        <div className="mt-3 pl-5 text-xs text-status-error">
          {chapter.error}
        </div>
      )}
    </div>
  );
}
