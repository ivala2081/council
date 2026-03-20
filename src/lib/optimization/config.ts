import type { LanguageModelUsage } from "ai";

// ============================================================
// Council Optimization Config
// Phase 1: Model tiers, pricing, cost calculation
// Phase 2+: Escalation thresholds, section depth, caching
// ============================================================

// --- Model Tiers ---
// Phase 2 will add confidence-driven escalation between tiers
export const MODEL_TIERS = {
  /** Routing, classification, extraction, summaries, derivatives */
  utility: "claude-haiku-4-5-20251001",
  /** Department agents, standard analysis, most briefs */
  balanced: "claude-sonnet-4-20250514",
  /** High-stakes synthesis, low-confidence escalation, premium mode */
  premium: "claude-opus-4-20250514",
} as const;

export type ModelTier = keyof typeof MODEL_TIERS;
export type ModelId = (typeof MODEL_TIERS)[ModelTier];

// --- Anthropic Pricing (USD per million tokens, as of 2025-05) ---
export const ANTHROPIC_PRICING: Record<
  ModelId,
  {
    inputPerMillion: number;
    outputPerMillion: number;
    cacheWritePerMillion: number;
    cacheReadPerMillion: number;
  }
> = {
  "claude-haiku-4-5-20251001": {
    inputPerMillion: 0.80,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.0,
    cacheReadPerMillion: 0.08,
  },
  "claude-sonnet-4-20250514": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheReadPerMillion: 0.30,
  },
  "claude-opus-4-20250514": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheReadPerMillion: 1.50,
  },
};

// --- Token Budgets ---
export const TOKEN_BUDGETS = {
  strategist: {
    maxOutputTokens: 5000,
    temperature: 0.7,
  },
  strategistConcise: {
    maxOutputTokens: 2500,
    temperature: 0.7,
  },
  // Deep thinking: temperature MUST be 1, maxOutputTokens covers thinking + output
  strategistDeep: {
    thinkingBudgetTokens: 10000,
    maxOutputTokens: 16000, // 10000 thinking + 6000 output
    temperature: 1 as const,
  },
} as const;

// --- Adaptive Token Budgets (Phase 2) ---
// Reduce output tokens for focused queries that don't need full depth.
// full_evaluation stays at default (no quality impact).
import type { QueryType } from "./section-depth";

export const ADAPTIVE_TOKEN_BUDGETS: Record<
  QueryType,
  { maxOutputTokens: number; temperature: number }
> = {
  full_evaluation: { maxOutputTokens: 5000, temperature: 0.7 },
  market_question: { maxOutputTokens: 4000, temperature: 0.7 },
  pricing_question: { maxOutputTokens: 3500, temperature: 0.7 },
  technical_question: { maxOutputTokens: 4000, temperature: 0.7 },
  pivot_decision: { maxOutputTokens: 4500, temperature: 0.7 },
  follow_up: { maxOutputTokens: 3000, temperature: 0.7 },
};

// --- Default Model Selection ---
export const DEFAULT_MODEL = MODEL_TIERS.balanced;

// --- Cost Calculation ---
export function calculateCostUsd(
  model: ModelId,
  usage: LanguageModelUsage
): number {
  const pricing = ANTHROPIC_PRICING[model];
  if (!pricing) return 0;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  // Non-cached input = total input minus cached portions
  const regularInput = Math.max(0, inputTokens - cacheRead - cacheWrite);

  return (
    (regularInput / 1_000_000) * pricing.inputPerMillion +
    (cacheRead / 1_000_000) * pricing.cacheReadPerMillion +
    (cacheWrite / 1_000_000) * pricing.cacheWritePerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

// --- Logging Helper ---
export function formatUsageLog(
  missionId: string | undefined,
  model: ModelId,
  usage: LanguageModelUsage,
  durationMs: number
): string {
  const costUsd = calculateCostUsd(model, usage);
  const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;

  return (
    `[mission] id=${missionId ?? "unknown"} ` +
    `model=${model} ` +
    `input=${usage.inputTokens ?? 0} output=${usage.outputTokens ?? 0} ` +
    `cacheRead=${cacheRead} cacheWrite=${cacheWrite} ` +
    `cost=$${costUsd.toFixed(6)} duration=${durationMs}ms`
  );
}
