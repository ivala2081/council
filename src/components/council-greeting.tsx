"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CouncilMark } from "./council-mark";
import { LoadingDots } from "./loading-dots";
import { getVerdict } from "@/lib/design-tokens";

interface Thread {
  id: string;
  name: string;
  latest_verdict: string | null;
  latest_score: number | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

interface CouncilGreetingProps {
  threads: Thread[];
  onNewIdea: () => void;
}

function getRuleFallback(threads: Thread[]): string {
  if (threads.length === 1) {
    const t = threads[0];
    return `${t.name} — ${t.latest_verdict ?? "analyzing"}. Ready to update?`;
  }
  return `${threads.length} ideas in progress. Which one should we work on?`;
}

export function CouncilGreeting({ threads, onNewIdea }: CouncilGreetingProps) {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) {
        setGreeting(getRuleFallback(threads));
        setLoaded(true);
      }
    }, 2000);

    fetch("/api/greeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threads }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.greeting) {
          setGreeting(data.greeting);
        } else {
          setGreeting(getRuleFallback(threads));
        }
        setLoaded(true);
      })
      .catch(() => {
        setGreeting(getRuleFallback(threads));
        setLoaded(true);
      });

    return () => clearTimeout(timer);
  }, [threads, loaded]);

  return (
    <div
      data-slot="council-greeting"
      className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
    >
      {/* Greeting */}
      <div className="flex gap-3 items-start">
        <CouncilMark className="h-6 w-6 shrink-0 mt-0.5" />
        {greeting ? (
          <p className="text-[15px] leading-relaxed text-foreground animate-fade-up">
            {greeting}
          </p>
        ) : (
          <LoadingDots />
        )}
      </div>

      {/* Thread cards */}
      <div className="flex flex-col gap-2">
        {threads.map((thread) => {
          const verdict = thread.latest_verdict?.toLowerCase() ?? "";
          const verdictStyle = getVerdict(verdict as "strong" | "promising" | "risky" | "weak");

          return (
            <Link
              key={thread.id}
              href={`/thread/${thread.id}`}
              className="group flex items-center justify-between rounded-xl border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {thread.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {thread.run_count} run{thread.run_count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {thread.latest_score !== null && (
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    {thread.latest_score}
                  </span>
                )}
                {thread.latest_verdict && (
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${verdictStyle.bg} ${verdictStyle.text}`}
                  >
                    {thread.latest_verdict}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onNewIdea}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          + New idea
        </button>
      </div>
    </div>
  );
}
