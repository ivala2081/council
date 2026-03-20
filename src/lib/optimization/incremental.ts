// ============================================================
// Phase 3: Incremental Brief Updates
// ============================================================
// When a company runs its 2nd+ mission, don't regenerate the
// entire brief from scratch. Inject a compressed summary of
// the previous brief so the model can build on existing analysis.
//
// This does NOT modify the system prompt — it enriches the
// user message with previous context, letting the model
// produce a more focused and cheaper brief.
// ============================================================

import type { StrategicBrief } from "@/lib/agents/types";

const MAX_CONTEXT_CHARS = 3000; // ~750 tokens

/**
 * Build a compressed summary of a previous brief to inject
 * as context for the next mission. This replaces replaying
 * the full mission history (anti-pattern #5).
 *
 * @returns Context string to prepend to user prompt, or null
 */
export function buildIncrementalContext(
  previousBrief: Record<string, unknown> | null
): string | null {
  if (!previousBrief) return null;

  const brief = previousBrief as Partial<StrategicBrief>;
  if (!brief.verdict) return null;

  const parts: string[] = [
    "## PREVIOUS BRIEF SUMMARY (for this company)",
    "Build on this analysis. Focus on what's NEW or CHANGED.",
    "",
  ];

  // Verdict summary
  if (brief.verdict) {
    parts.push(
      `Previous verdict: ${brief.verdict.verdict} (score: ${brief.verdict.councilScore}/${brief.verdict.baseScore})`
    );
    if (brief.verdict.verdictReasoning) {
      parts.push(`Reasoning: ${brief.verdict.verdictReasoning}`);
    }
    parts.push("");
  }

  // Key assumptions that need re-evaluation
  if (brief.assumptionLedger && brief.assumptionLedger.length > 0) {
    const speculative = brief.assumptionLedger.filter(
      (a) => a.confidence === "speculative"
    );
    if (speculative.length > 0) {
      parts.push("Unvalidated assumptions from last time:");
      for (const a of speculative.slice(0, 3)) {
        parts.push(`- ${a.assumption}`);
      }
      parts.push("");
    }
  }

  // Previous risks
  if (brief.whyThisMayFail && brief.whyThisMayFail.length > 0) {
    parts.push("Previously identified failure modes:");
    for (const risk of brief.whyThisMayFail.slice(0, 3)) {
      parts.push(`- ${risk}`);
    }
    parts.push("");
  }

  // Competitors already analyzed
  if (brief.market?.competitors && brief.market.competitors.length > 0) {
    const names = brief.market.competitors.map((c) => c.name).join(", ");
    parts.push(`Previously analyzed competitors: ${names}`);
    parts.push("");
  }

  // Penalties from last time
  if (brief.verdict?.penalties) {
    const applied = brief.verdict.penalties.filter((p) => p.applied);
    if (applied.length > 0) {
      parts.push(
        `Previous penalties: ${applied.map((p) => p.id).join(", ")}`
      );
      parts.push("");
    }
  }

  const result = parts.join("\n");

  // Truncate if too long
  if (result.length > MAX_CONTEXT_CHARS) {
    return result.slice(0, MAX_CONTEXT_CHARS) + "\n[context truncated]";
  }

  return result;
}
