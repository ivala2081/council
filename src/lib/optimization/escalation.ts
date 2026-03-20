import type { StrategicBrief } from "@/lib/agents/types";
import { type ModelTier } from "./config";

// ============================================================
// Phase 2: Confidence-Driven Model Escalation
// ============================================================
// Instead of blanket Opus usage, selectively escalate only
// when brief shows high uncertainty.
//
// Implementation: conditional only (not default)
// ============================================================

export type EscalatableSection =
  | "market"
  | "assumptions"
  | "decisions";

export interface EscalationSignal {
  section: EscalatableSection;
  reason: string;
}

/**
 * Analyze a completed brief and determine if re-generation
 * with a premium model is warranted.
 *
 * Returns empty array if no escalation needed (saves Opus cost).
 */
export function detectEscalationNeeded(
  brief: StrategicBrief
): EscalationSignal[] {
  const signals: EscalationSignal[] = [];

  // Many speculative assumptions → escalate
  const speculativeCount = brief.assumptionLedger.filter(
    (a) => a.confidence === "speculative"
  ).length;
  if (speculativeCount >= 4) {
    signals.push({
      section: "assumptions",
      reason: `${speculativeCount} speculative assumptions detected`,
    });
  }

  // Many speculative competitor analyses → escalate market
  const speculativeCompetitors = brief.market.competitors.filter(
    (c) => c.confidence === "speculative"
  ).length;
  if (speculativeCompetitors >= 2) {
    signals.push({
      section: "market",
      reason: `${speculativeCompetitors} competitors with speculative confidence`,
    });
  }

  // Low overall score with multiple critical decisions → escalate
  const criticalDecisions = brief.decisionAgenda.filter(
    (d) => d.priority === "critical"
  ).length;
  if (brief.verdict.councilScore < 50 && criticalDecisions >= 2) {
    signals.push({
      section: "decisions",
      reason: `Low score (${brief.verdict.councilScore}) with ${criticalDecisions} critical decisions`,
    });
  }

  return signals;
}

/**
 * Select model tier based on escalation signals.
 */
export function selectModelForSection(
  section: EscalatableSection,
  signals: EscalationSignal[]
): ModelTier {
  const needsEscalation = signals.some((s) => s.section === section);
  return needsEscalation ? "premium" : "balanced";
}
