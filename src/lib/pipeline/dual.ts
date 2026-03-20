/**
 * Dual-Step Pipeline
 *
 * Step 1: Triage (Haiku) — extract structured context from prompt
 * Step 2: Strategist (Sonnet) — generate brief with enriched context
 *
 * The hypothesis: giving the strategist structured context about the
 * founder's profile, concerns, and priorities produces a sharper brief
 * than sending the raw prompt alone.
 */

import Anthropic from "@anthropic-ai/sdk";
import { TRIAGE_SYSTEM_PROMPT, type TriageOutput } from "../agents/triage";
import { STRATEGIST_SYSTEM_PROMPT } from "../agents/strategist";
import { MODEL_TIERS, ANTHROPIC_PRICING, type ModelId } from "../optimization/config";

const TRIAGE_MODEL = MODEL_TIERS.utility;
const STRATEGIST_MODEL = MODEL_TIERS.balanced;

export interface DualStepResult {
  triage: {
    output: TriageOutput | null;
    rawText: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
    durationMs: number;
  };
  strategist: {
    brief: Record<string, unknown> | null;
    rawText: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd: number;
    durationMs: number;
  };
  totalCostUsd: number;
  totalDurationMs: number;
}

function calcCost(model: ModelId, input: number, output: number, cacheRead: number, cacheWrite: number): number {
  const pricing = ANTHROPIC_PRICING[model];
  if (!pricing) return 0;
  const regularInput = Math.max(0, input - cacheRead - cacheWrite);
  return (
    (regularInput / 1_000_000) * pricing.inputPerMillion +
    (cacheRead / 1_000_000) * pricing.cacheReadPerMillion +
    (cacheWrite / 1_000_000) * pricing.cacheWritePerMillion +
    (output / 1_000_000) * pricing.outputPerMillion
  );
}

function buildEnrichedPrompt(userPrompt: string, triage: TriageOutput): string {
  return `## Triage Context (pre-analyzed)

**Idea Type:** ${triage.ideaType}
**Query Type:** ${triage.queryType}

**Founder Profile:**
- Team size: ${triage.founderProfile.teamSize}
- Technical: ${triage.founderProfile.isTechnical}
- Budget: ${triage.founderProfile.budget}
- Experience: ${triage.founderProfile.experience}

**Extracted Context:**
- Core problem: ${triage.extractedContext.coreProblem}
- Target market: ${triage.extractedContext.targetMarket}
- Proposed solution: ${triage.extractedContext.proposedSolution}
- Revenue model: ${triage.extractedContext.revenueModel}
- Constraints: ${triage.extractedContext.constraints.join("; ")}

**Founder's Key Concerns:**
${triage.extractedContext.statedConcerns.map((c) => `- ${c}`).join("\n")}

**Open Decisions:**
${triage.extractedContext.openDecisions.map((d) => `- ${d}`).join("\n")}

**Section Priorities:**
- Market Analysis: ${triage.sectionPriorities.marketAnalysis}
- Technical Feasibility: ${triage.sectionPriorities.technicalFeasibility}
- Business Model: ${triage.sectionPriorities.businessModel}
- Risk Assessment: ${triage.sectionPriorities.riskAssessment}
- Decision Agenda: ${triage.sectionPriorities.decisionAgenda}

**Key Questions to Answer:**
${triage.keyQuestions.map((q) => `- ${q}`).join("\n")}

**Language:** ${triage.language}

---

## Original Founder Prompt

${userPrompt}`;
}

export async function runDualPipeline(
  client: Anthropic,
  userPrompt: string
): Promise<DualStepResult> {
  // --- Step 1: Triage (Haiku) ---
  const triageStart = Date.now();
  const triageResponse = await client.messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 1500,
    temperature: 0.3,
    system: [
      {
        type: "text",
        text: TRIAGE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });
  const triageDuration = Date.now() - triageStart;

  const triageRaw = triageResponse.content[0].type === "text" ? triageResponse.content[0].text : "";
  const triageInput = triageResponse.usage.input_tokens;
  const triageOutput = triageResponse.usage.output_tokens;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triageUsage = triageResponse.usage as any;
  const triageCacheRead = triageUsage.cache_read_input_tokens ?? 0;
  const triageCacheWrite = triageUsage.cache_creation_input_tokens ?? 0;
  const triageCost = calcCost(TRIAGE_MODEL as ModelId, triageInput, triageOutput, triageCacheRead, triageCacheWrite);

  let triageOutput_parsed: TriageOutput | null = null;
  try {
    const cleaned = triageRaw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    triageOutput_parsed = JSON.parse(cleaned);
  } catch {
    // Triage parse failed — fall back to raw prompt for strategist
  }

  // --- Step 2: Strategist (Sonnet) ---
  const enrichedPrompt = triageOutput_parsed
    ? buildEnrichedPrompt(userPrompt, triageOutput_parsed)
    : userPrompt;

  const stratStart = Date.now();
  const stratResponse = await client.messages.create({
    model: STRATEGIST_MODEL,
    max_tokens: 8000,
    temperature: 0.7,
    system: [
      {
        type: "text",
        text: STRATEGIST_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: enrichedPrompt }],
  });
  const stratDuration = Date.now() - stratStart;

  const stratRaw = stratResponse.content[0].type === "text" ? stratResponse.content[0].text : "";
  const stratInput = stratResponse.usage.input_tokens;
  const stratOutput_tokens = stratResponse.usage.output_tokens;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stratUsage = stratResponse.usage as any;
  const stratCacheRead = stratUsage.cache_read_input_tokens ?? 0;
  const stratCacheWrite = stratUsage.cache_creation_input_tokens ?? 0;
  const stratCost = calcCost(STRATEGIST_MODEL as ModelId, stratInput, stratOutput_tokens, stratCacheRead, stratCacheWrite);

  let brief: Record<string, unknown> | null = null;
  try {
    const cleaned = stratRaw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    brief = JSON.parse(cleaned);
  } catch {
    // JSON parse failed
  }

  return {
    triage: {
      output: triageOutput_parsed,
      rawText: triageRaw,
      model: TRIAGE_MODEL,
      inputTokens: triageInput,
      outputTokens: triageOutput,
      cacheReadTokens: triageCacheRead,
      cacheWriteTokens: triageCacheWrite,
      costUsd: triageCost,
      durationMs: triageDuration,
    },
    strategist: {
      brief,
      rawText: stratRaw,
      model: STRATEGIST_MODEL,
      inputTokens: stratInput,
      outputTokens: stratOutput_tokens,
      cacheReadTokens: stratCacheRead,
      cacheWriteTokens: stratCacheWrite,
      costUsd: stratCost,
      durationMs: stratDuration,
    },
    totalCostUsd: triageCost + stratCost,
    totalDurationMs: triageDuration + stratDuration,
  };
}
