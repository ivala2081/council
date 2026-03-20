"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "@/lib/track-event";

interface FeedbackFormProps {
  missionId: string | null;
  onSubmitted?: () => void;
}

const DIMENSIONS = [
  { key: "specificity", label: "Specificity", desc: "Named real companies, concrete numbers?" },
  { key: "actionability", label: "Actionability", desc: "Could you act on this TODAY?" },
  { key: "depth", label: "Depth", desc: "Non-obvious insights, second-order thinking?" },
  { key: "accuracy", label: "Realism", desc: "Grounded in reality, honest about uncertainty?" },
  { key: "decision_clarity", label: "Decision Clarity", desc: "Clear decisions with tradeoffs?" },
] as const;

export function FeedbackForm({ missionId, onSubmitted }: FeedbackFormProps) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [overall, setOverall] = useState<number>(0);
  const [freeText, setFreeText] = useState("");
  const [wouldPay, setWouldPay] = useState<boolean | null>(null);
  const [wouldUseAgain, setWouldUseAgain] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!missionId || overall === 0) return;
    setSubmitting(true);

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId,
          overall_score: overall,
          specificity_score: scores.specificity || null,
          actionability_score: scores.actionability || null,
          depth_score: scores.depth || null,
          accuracy_score: scores.accuracy || null,
          decision_clarity_score: scores.decision_clarity || null,
          free_text: freeText || null,
          would_pay: wouldPay,
          would_use_again: wouldUseAgain,
        }),
      });
      trackEvent({
        event: "feedback_submitted",
        mission_id: missionId ?? undefined,
        metadata: { overall_score: overall, would_pay: wouldPay },
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      // Silent fail — feedback is non-critical
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-status-success/20 bg-status-success/5 p-6 text-center">
        <svg className="w-8 h-8 text-status-success mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm text-muted-foreground">
          Thanks for your feedback! This helps Council improve.
        </p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border bg-card p-4 text-center hover:border-primary/30 hover:bg-muted/30 transition-all group"
      >
        <p className="text-sm font-medium group-hover:text-primary transition-colors">
          Rate this brief
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your feedback directly improves Council. Takes 30 seconds.
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">Rate this brief</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your feedback directly improves Council.
        </p>
      </div>
      <div className="px-5 sm:px-6 py-5 space-y-5">
        {/* Overall Score */}
        <div>
          <p className="text-sm font-medium mb-2">Overall quality</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setOverall(n)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                  overall === n
                    ? "bg-primary text-primary-foreground shadow-sm scale-105"
                    : "border hover:bg-muted hover:scale-105"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">1 = useless, 5 = excellent</p>
        </div>

        {/* Dimension Scores */}
        <div className="space-y-2.5">
          <p className="text-sm font-medium">Section quality <span className="text-muted-foreground font-normal">(optional)</span></p>
          {DIMENSIONS.map((dim) => (
            <div key={dim.key} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm">{dim.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{dim.desc}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setScores((s) => ({ ...s, [dim.key]: n }))}
                    className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                      scores[dim.key] === n
                        ? "bg-primary text-primary-foreground"
                        : "border hover:bg-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Key Questions */}
        <div className="flex gap-6">
          <div>
            <p className="text-sm font-medium mb-1.5">Would you pay?</p>
            <div className="flex gap-1.5">
              {[
                { label: "Yes", value: true },
                { label: "No", value: false },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setWouldPay(value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    wouldPay === value
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Use again?</p>
            <div className="flex gap-1.5">
              {[
                { label: "Yes", value: true },
                { label: "No", value: false },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setWouldUseAgain(value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    wouldUseAgain === value
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Free text */}
        <div>
          <p className="text-sm font-medium mb-1.5">What could be better? <span className="text-muted-foreground font-normal">(optional)</span></p>
          <Textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="The market analysis was too generic..."
            rows={2}
            className="resize-none"
          />
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={overall === 0 || submitting}
          className="w-full"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </Button>
      </div>
    </div>
  );
}
