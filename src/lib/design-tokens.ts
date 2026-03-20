/**
 * AiCompanyOS Unified Design Tokens
 *
 * Single source of truth for semantic styling across all components.
 * Maps domain concepts (verdict, priority, confidence, status) to
 * Tailwind classes that reference CSS custom properties in globals.css.
 *
 * Usage:
 *   import { verdict, priority, status } from "@/lib/design-tokens"
 *   <span className={verdict.strong.text}>STRONG</span>
 *   <div className={verdict.strong.bg}>...</div>
 */

// ---------------------------------------------------------------------------
// Verdict — the 4 states that define Council scoring
// ---------------------------------------------------------------------------
export const verdict = {
  strong: {
    text: "text-verdict-strong",
    bg: "bg-verdict-strong/10",
    bgSolid: "bg-verdict-strong",
    border: "border-verdict-strong/20",
    ring: "stroke-verdict-strong",
    dot: "bg-verdict-strong",
    badge: "bg-verdict-strong/15 text-verdict-strong border-0",
  },
  promising: {
    text: "text-verdict-promising",
    bg: "bg-verdict-promising/10",
    bgSolid: "bg-verdict-promising",
    border: "border-verdict-promising/20",
    ring: "stroke-verdict-promising",
    dot: "bg-verdict-promising",
    badge: "bg-verdict-promising/15 text-verdict-promising border-0",
  },
  risky: {
    text: "text-verdict-risky",
    bg: "bg-verdict-risky/10",
    bgSolid: "bg-verdict-risky",
    border: "border-verdict-risky/20",
    ring: "stroke-verdict-risky",
    dot: "bg-verdict-risky",
    badge: "bg-verdict-risky/15 text-verdict-risky border-0",
  },
  weak: {
    text: "text-verdict-weak",
    bg: "bg-verdict-weak/10",
    bgSolid: "bg-verdict-weak",
    border: "border-verdict-weak/20",
    ring: "stroke-verdict-weak",
    dot: "bg-verdict-weak",
    badge: "bg-verdict-weak/15 text-verdict-weak border-0",
  },
} as const;

export type VerdictKey = keyof typeof verdict;

export function getVerdict(key: string) {
  return verdict[key as VerdictKey] ?? verdict.risky;
}

// ---------------------------------------------------------------------------
// Priority — decision urgency levels
// ---------------------------------------------------------------------------
export const priority = {
  critical: {
    text: "text-priority-critical",
    bg: "bg-priority-critical/5 border-priority-critical/15",
    label: "text-priority-critical",
  },
  important: {
    text: "text-priority-important",
    bg: "bg-priority-important/5 border-priority-important/15",
    label: "text-priority-important",
  },
  consider: {
    text: "text-priority-consider",
    bg: "bg-priority-consider/5 border-priority-consider/15",
    label: "text-priority-consider",
  },
} as const;

export type PriorityKey = keyof typeof priority;

export function getPriority(key: string) {
  return priority[key as PriorityKey] ?? priority.consider;
}

// ---------------------------------------------------------------------------
// Confidence — data reliability indicators
// ---------------------------------------------------------------------------
export const confidence = {
  verified: {
    text: "text-confidence-verified",
    badge: "bg-confidence-verified/15 text-confidence-verified",
  },
  estimated: {
    text: "text-confidence-estimated",
    badge: "bg-confidence-estimated/15 text-confidence-estimated",
  },
  speculative: {
    text: "text-confidence-speculative",
    badge: "bg-confidence-speculative/15 text-confidence-speculative",
  },
} as const;

export type ConfidenceKey = keyof typeof confidence;

export function getConfidence(key: string) {
  return confidence[key as ConfidenceKey] ?? confidence.estimated;
}

// ---------------------------------------------------------------------------
// Status — universal UI feedback states
// ---------------------------------------------------------------------------
export const status = {
  success: {
    text: "text-status-success",
    bg: "bg-status-success/10",
    bgSolid: "bg-status-success",
    border: "border-status-success/20",
    badge: "bg-status-success/15 text-status-success border-0",
  },
  warning: {
    text: "text-status-warning",
    bg: "bg-status-warning/10",
    bgSolid: "bg-status-warning",
    border: "border-status-warning/20",
    badge: "bg-status-warning/15 text-status-warning border-0",
  },
  error: {
    text: "text-status-error",
    bg: "bg-status-error/10",
    bgSolid: "bg-status-error",
    border: "border-status-error/20",
    badge: "bg-status-error/15 text-status-error border-0",
  },
  info: {
    text: "text-status-info",
    bg: "bg-status-info/10",
    bgSolid: "bg-status-info",
    border: "border-status-info/20",
    badge: "bg-status-info/15 text-status-info border-0",
  },
} as const;

// ---------------------------------------------------------------------------
// Score bar color — maps numeric score to appropriate status
// ---------------------------------------------------------------------------
export function getScoreColor(score: number, max: number = 20): string {
  const pct = score / max;
  if (pct >= 0.8) return "bg-status-success";
  if (pct >= 0.55) return "bg-status-warning";
  if (pct >= 0.3) return "bg-priority-important";
  return "bg-status-error";
}

// ---------------------------------------------------------------------------
// Delta — positive/negative change indicators
// ---------------------------------------------------------------------------
export const delta = {
  positive: {
    text: "text-status-success",
    bg: "bg-status-success/10 text-status-success",
  },
  negative: {
    text: "text-status-error",
    bg: "bg-status-error/10 text-status-error",
  },
  neutral: {
    text: "text-muted-foreground",
    bg: "bg-muted text-muted-foreground",
  },
} as const;

export function getDelta(value: number) {
  if (value > 0) return delta.positive;
  if (value < 0) return delta.negative;
  return delta.neutral;
}

// ---------------------------------------------------------------------------
// Penalty labels — human-readable names
// ---------------------------------------------------------------------------
export const penaltyLabels: Record<string, string> = {
  capitalInsufficient: "Capital Insufficient",
  founderMarketMismatch: "Founder-Market Mismatch",
  noDistribution: "No Distribution",
};
