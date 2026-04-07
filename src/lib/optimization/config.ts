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

// --- Agent-Specific Token Budgets (V2) ---
// Max output tokens per agent, tuned for cost optimization
import type { AgentName } from "../agents/types";

export const AGENT_TOKEN_BUDGETS: Partial<Record<AgentName, { maxOutputTokens: number }>> = {
  ceo: { maxOutputTokens: 200 },
  strategist: { maxOutputTokens: 5000 },
  product_scope: { maxOutputTokens: 4096 },
  tech_architect: { maxOutputTokens: 8192 },
  designer: { maxOutputTokens: 8192 },
  fullstack_engineer: { maxOutputTokens: 16384 },
  backend_engineer: { maxOutputTokens: 32768 },
  frontend_engineer: { maxOutputTokens: 32768 },
  infra_ops: { maxOutputTokens: 16384 },
  qa_writer: { maxOutputTokens: 16384 },
  verification: { maxOutputTokens: 1024 },
  content_writer: { maxOutputTokens: 16384 },
};

/** Get max output tokens for an agent, with complexity override */
export function getMaxTokens(agentName: AgentName, complexity?: string): number {
  const budget = AGENT_TOKEN_BUDGETS[agentName];
  if (!budget) return 4096;

  // Simple projects get reduced budgets for design agents
  if (complexity === "simple") {
    if (agentName === "designer") return 4096;
    if (agentName === "fullstack_engineer") return 16384;
  }

  return budget.maxOutputTokens;
}

// --- Shared System Prompt Preamble (cached across agents) ---
export const SHARED_PREAMBLE = `You are an agent of Council, an AI-powered software company. You produce structured JSON output.

RULES:
- Respond with ONLY valid JSON. No markdown fences, no explanation text.
- Be specific to THIS project. Never give generic advice.
- All code must be production-ready TypeScript with strict types.
- Default stack: Next.js 16 + React 19 + Supabase + Tailwind CSS 4 + shadcn/ui + Vercel.
`;

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
