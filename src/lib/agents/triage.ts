/**
 * Triage Agent — Haiku
 *
 * Step 1 of dual-step pipeline.
 * Analyzes the founder's prompt and extracts structured context
 * that the strategist can use to produce a sharper brief.
 *
 * Cost: ~$0.001-0.003 per call (Haiku pricing)
 * Latency: ~3-5s
 */

import { z } from "zod";

export const triageOutputSchema = z.object({
  ideaType: z.enum([
    "saas_b2b",
    "saas_b2c",
    "marketplace",
    "consumer_app",
    "hardware",
    "fintech",
    "healthtech",
    "edtech",
    "ai_tool",
    "other",
  ]),
  queryType: z.enum([
    "full_evaluation",
    "market_question",
    "pricing_question",
    "technical_question",
    "pivot_decision",
    "follow_up",
  ]),
  founderProfile: z.object({
    teamSize: z.number(),
    isTechnical: z.boolean(),
    budget: z.string(),
    experience: z.string(),
  }),
  extractedContext: z.object({
    coreProblem: z.string(),
    targetMarket: z.string(),
    proposedSolution: z.string(),
    revenueModel: z.string(),
    statedConcerns: z.array(z.string()),
    openDecisions: z.array(z.string()),
    constraints: z.array(z.string()),
  }),
  sectionPriorities: z.object({
    marketAnalysis: z.enum(["detailed", "standard", "brief"]),
    technicalFeasibility: z.enum(["detailed", "standard", "brief"]),
    businessModel: z.enum(["detailed", "standard", "brief"]),
    riskAssessment: z.enum(["detailed", "standard", "brief"]),
    decisionAgenda: z.enum(["detailed", "standard", "brief"]),
  }),
  keyQuestions: z.array(z.string()),
  language: z.string(),
});

export type TriageOutput = z.infer<typeof triageOutputSchema>;

export const TRIAGE_SYSTEM_PROMPT = `You are a triage analyst. Your job is to read a founder's prompt and extract structured context for a strategist agent.

Analyze the prompt carefully and produce a JSON object with:

1. **ideaType**: Classify the business type
2. **queryType**: What is the founder actually asking?
3. **founderProfile**: Team size, technical ability, budget, experience
4. **extractedContext**: Core problem, target market, solution, revenue model, stated concerns, open decisions, constraints
5. **sectionPriorities**: Which sections of a strategic brief need the most depth?
   - If founder asks about pricing → businessModel: "detailed"
   - If founder is non-technical → technicalFeasibility: "detailed"
   - If crowded market → marketAnalysis: "detailed"
   - decisionAgenda should always be "detailed"
6. **keyQuestions**: 3-5 specific questions the strategist should answer
7. **language**: Detected language code (e.g. "en", "tr", "es")

Respond with a valid JSON object only. No markdown fences, no explanation.`;
