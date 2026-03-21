"use client";

import { useState, useEffect } from "react";

interface EmailCaptureProps {
  ownerToken: string;
}

const DISMISS_KEY = "council_email_dismissed_at";

export function EmailCapture({ ownerToken }: EmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if already dismissed or already provided
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince =
        (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    const existingEmail = localStorage.getItem("council_email");
    if (existingEmail) return;

    // Show after a delay
    const timer = setTimeout(() => setHidden(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (hidden || submitted) {
    if (submitted) {
      return (
        <div
          data-slot="email-capture"
          className="rounded-xl bg-muted/30 p-4 animate-fade-up"
        >
          <p className="text-sm text-muted-foreground">
            You&apos;ll hear from Council when your sprint ends.
          </p>
        </div>
      );
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken, email }),
      });
      if (res.ok) {
        localStorage.setItem("council_email", email);
        setSubmitted(true);
      }
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setHidden(true);
  };

  return (
    <div
      data-slot="email-capture"
      className="rounded-xl bg-muted/30 p-4 animate-fade-up"
    >
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <p className="text-sm text-foreground mb-2">
            Sprint plan is 7 days. Want a reminder when it ends?
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
            Only sprint reminders. No spam.
          </p>
        </div>
        <div className="flex items-end gap-2 sm:flex-col sm:justify-end">
          <button
            type="submit"
            disabled={submitting || !email.includes("@")}
            className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {submitting ? "..." : "Yes"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Not now
          </button>
        </div>
      </form>
    </div>
  );
}
