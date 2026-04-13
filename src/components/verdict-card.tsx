"use client";

import { useState } from "react";
import type { V2Verdict } from "@/lib/agents/types";
import { useLang } from "@/lib/i18n";
import { saveFeedback, getFeedback } from "@/lib/storage";

// ---- URL helpers for clickable evidence sources ----
function isUrl(s: string | undefined): s is string {
  if (!s) return false;
  return s.startsWith("http://") || s.startsWith("https://");
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname.slice(0, 30);
    return host + (path.length > 0 ? path + (u.pathname.length > 30 ? "…" : "") : "");
  } catch {
    return url.slice(0, 40) + (url.length > 40 ? "…" : "");
  }
}

// ---- Verdict Styles ----
const verdictConfig = {
  GO: {
    label: "GO",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    barColor: "bg-emerald-500",
  },
  PIVOT: {
    label: "PIVOT",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    barColor: "bg-amber-500",
  },
  DONT: {
    label: "DON'T",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    barColor: "bg-red-500",
  },
} as const;

const confidenceColor = (score: number) =>
  score >= 80
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 60
      ? "text-amber-600 dark:text-amber-400"
      : score >= 40
        ? "text-orange-600 dark:text-orange-400"
        : "text-red-600 dark:text-red-400";

const confidenceBarColor = (score: number) =>
  score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";

interface VerdictCardProps {
  verdict: V2Verdict;
  missionId?: string | null;
  verdictId?: string | null;
}

export function VerdictCard({ verdict, missionId, verdictId }: VerdictCardProps) {
  const { t } = useLang();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  // Check if already rated (lazy init from localStorage)
  const existingFeedback = verdictId ? getFeedback(verdictId) : null;
  const [feedbackState, setFeedbackState] = useState<"idle" | "rated" | "commenting" | "done">(
    existingFeedback ? "done" : "idle"
  );
  const [feedbackRating, setFeedbackRating] = useState<"up" | "down" | null>(
    existingFeedback?.rating ?? null
  );
  const [feedbackComment, setFeedbackComment] = useState("");

  const handleFeedback = (rating: "up" | "down") => {
    setFeedbackRating(rating);
    setFeedbackState("commenting");
  };

  const submitFeedback = () => {
    if (!verdictId || !feedbackRating) return;
    saveFeedback({
      verdictId,
      rating: feedbackRating,
      comment: feedbackComment.trim() || undefined,
      timestamp: Date.now(),
    });
    setFeedbackState("done");
  };

  const config = verdictConfig[verdict.verdict];
  const conf = verdict.confidence;

  const tagline = {
    GO: t("verdict_go_tagline"),
    PIVOT: t("verdict_pivot_tagline"),
    DONT: t("verdict_dont_tagline"),
  }[verdict.verdict];

  const evidenceLabel: Record<string, string> = {
    market_data: t("evidence_market_data"),
    competitor: t("evidence_competitor"),
    financial: t("evidence_financial"),
    technical: t("evidence_technical"),
    legal: t("evidence_legal"),
    pattern: t("evidence_pattern"),
    training_data: t("evidence_training_data"),
    assumption: t("evidence_assumption"),
  };

  const handleCopy = () => {
    const url = verdictId
      ? `${window.location.origin}/v/${verdictId}`
      : missionId
        ? `${window.location.origin}/brief/${missionId}`
        : window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTweet = () => {
    const text = verdict.shareable?.tweet ?? `Council verdict: ${verdict.verdict} — ${verdict.idea_summary}`;
    const url = verdictId ? `${window.location.origin}/v/${verdictId}` : "";
    const tweetUrl = url
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
      : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, "_blank");
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Main verdict card */}
      <div className={`rounded-2xl border ${config.border} ${config.bg} overflow-hidden`}>
        {/* Verdict header */}
        <div className="px-6 pt-6 pb-4">
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            &ldquo;{verdict.idea_summary}&rdquo;
          </p>

          <div className="flex items-center gap-3 mb-1">
            <div className={`w-3 h-3 rounded-full ${config.dot}`} />
            <span className={`text-3xl font-black tracking-tight ${config.text}`}>
              {config.label}
            </span>
          </div>
          <p className={`text-sm font-medium ${config.text} opacity-70`}>{tagline}</p>
        </div>

        {/* Confidence bar */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("confidence_label")}
            </span>
            <span className={`text-sm font-bold tabular-nums ${confidenceColor(conf.score)}`}>
              {conf.score}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
            <div
              className={`h-full rounded-full ${confidenceBarColor(conf.score)} transition-all duration-700`}
              style={{ width: `${conf.score}%` }}
            />
          </div>
          {conf.missing_data && conf.missing_data.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conf.missing_data.map((d, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {d}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* 3 Reasons */}
        <div className="border-t border-foreground/5">
          {verdict.reasons.map((reason, i) => (
            <div
              key={i}
              className={`px-6 py-4 ${i < verdict.reasons.length - 1 ? "border-b border-foreground/5" : ""}`}
            >
              <div className="flex gap-3">
                <span className={`shrink-0 w-6 h-6 rounded-full ${config.bg} ${config.text} flex items-center justify-center text-xs font-bold border ${config.border}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-relaxed">{reason.text}</p>
                  {reason.evidence ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {evidenceLabel[reason.evidence.type] ?? reason.evidence.type}
                      </span>
                      {reason.evidence.source ? (
                        isUrl(reason.evidence.source) ? (
                          <a
                            href={reason.evidence.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2"
                            title={reason.evidence.source}
                          >
                            {shortenUrl(reason.evidence.source)}
                            <svg className="w-2.5 h-2.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground truncate">
                            {reason.evidence.source}
                          </span>
                        )
                      ) : null}
                    </div>
                  ) : null}
                  {showDetails && reason.evidence?.detail ? (
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                      {reason.evidence.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pivot suggestion */}
        {verdict.pivot_suggestion ? (
          <div className="px-6 py-4 border-t border-foreground/5 bg-foreground/[0.02]">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              {t("instead_try")}
            </p>
            <p className="text-sm font-medium text-foreground">{verdict.pivot_suggestion.suggestion}</p>
            <p className="text-xs text-muted-foreground mt-1">{verdict.pivot_suggestion.why}</p>
          </div>
        ) : null}
      </div>

      {/* Expand / collapse details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        {showDetails ? t("hide_details") : t("show_details")}
      </button>

      {/* Optional sections when expanded */}
      {showDetails ? (
        <div className="space-y-3">
          {/* Financials */}
          {verdict.financials ? (
            <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t("financials_title")}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t("mvp_cost")}</p>
                  <p className="font-semibold">${verdict.financials.estimated_mvp_cost_monthly_usd}/mo</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("breakeven")}</p>
                  <p className="font-semibold">{verdict.financials.breakeven_users} {t("users")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("suggested_price")}</p>
                  <p className="font-semibold">${verdict.financials.suggested_price_usd}/mo</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("business_model")}</p>
                  <p className="font-semibold">{verdict.financials.business_model}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Tech snapshot */}
          {verdict.tech_snapshot ? (
            <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {t("tech_title")}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("stack")}</span>
                  <span className="font-medium">{verdict.tech_snapshot.stack_suggestion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("complexity")}</span>
                  <span className="font-medium capitalize">{verdict.tech_snapshot.complexity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("mvp_timeline")}</span>
                  <span className="font-medium">{verdict.tech_snapshot.estimated_mvp_weeks} {t("weeks")}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Legal flags */}
          {verdict.legal_flags && verdict.legal_flags.length > 0 ? (
            <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-3">
                {t("legal_title")}
              </p>
              <div className="space-y-2">
                {verdict.legal_flags.map((flag, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        flag.severity === "critical" ? "bg-red-500/20 text-red-600 dark:text-red-400" :
                        flag.severity === "high" ? "bg-orange-500/20 text-orange-600 dark:text-orange-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {flag.severity.toUpperCase()}
                      </span>
                      <span className="font-medium">{flag.risk}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-[calc(theme(spacing.1.5)*2+theme(spacing.2))]">
                      {flag.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Share bar */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors text-sm"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          {copied ? t("copied") : t("copy_link")}
        </button>
        <button
          onClick={handleTweet}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors text-sm"
        >
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {t("tweet")}
        </button>
      </div>

      {/* Feedback widget */}
      {verdictId && (
        <div className="pt-2">
          {feedbackState === "idle" && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs text-muted-foreground/70">{t("feedback_helpful")}</span>
              <button
                onClick={() => handleFeedback("up")}
                className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0H22.5a2.25 2.25 0 0 1 0 4.5h-.667c.336.364.53.853.53 1.384 0 .843-.502 1.567-1.222 1.896.362.462.566 1.045.566 1.673 0 .758-.345 1.436-.886 1.884.252.404.397.883.397 1.394 0 1.489-1.198 2.696-2.677 2.696H12.62c-.547 0-1.085-.124-1.576-.362-.89-.432-1.906-.652-2.943-.652H6.632m0-6.75h.77c1.354 0 2.59-.84 3.245-2.01a6.013 6.013 0 0 1 .552-.834" />
                </svg>
              </button>
              <button
                onClick={() => handleFeedback("down")}
                className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/30 transition-colors text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.861-2.4c.498-.634 1.226-1.08 2.032-1.08h.384" />
                </svg>
              </button>
            </div>
          )}

          {feedbackState === "commenting" && (
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitFeedback() }}
                placeholder={t("feedback_comment_placeholder")}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-border/60 bg-transparent placeholder:text-muted-foreground/60 focus:outline-none"
                autoFocus
                maxLength={200}
              />
              <button
                onClick={submitFeedback}
                className="text-xs px-3 py-2 rounded-lg bg-foreground text-background font-medium hover:opacity-80 transition-all"
              >
                {t("feedback_send")}
              </button>
            </div>
          )}

          {feedbackState === "done" && (
            <p className="text-center text-xs text-muted-foreground/70">
              {feedbackRating === "up" ? "👍" : "👎"} {t("feedback_thanks")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
