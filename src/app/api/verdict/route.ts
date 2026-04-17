import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import Exa from "exa-js";
import { z } from "zod";
import promptConfig from "@/../prompts/v2-system-prompt.json";
import schemaConfig from "@/../prompts/v2-output-schema.json";
import { ANTHROPIC_PRICING } from "@/lib/optimization/config";

// Force Node.js runtime (not edge) — Anthropic SDK requires it
export const runtime = "nodejs";

// Disable Next.js caching for this route — verdicts are non-idempotent
export const dynamic = "force-dynamic";

// DEVIATION FROM SPEC: append the JSON schema to the system prompt to match
// the configuration that achieved the 20/20 golden test pass
// (see benchmark/v2-eval.ts:285-289). The spec's literal `promptConfig.system_prompt`
// alone causes Claude to send wrong enum casing, null fields, and empty objects.
const SYSTEM_TEXT =
  promptConfig.system_prompt +
  "\n\n## OUTPUT SCHEMA\n\nYou MUST respond with valid JSON matching this exact schema:\n\n```json\n" +
  JSON.stringify(schemaConfig.verdict_schema, null, 2) +
  "\n```";

// ============================================================
// Schemas
// ============================================================

// --- Verdict schema (pasted from prompts/v2-output-schema.json zod_typescript field) ---

const EvidenceSchema = z.object({
  type: z.enum([
    "market_data",
    "competitor",
    "financial",
    "technical",
    "legal",
    "pattern",
    "training_data",
    "assumption",
  ]),
  source: z.string().optional(),
  detail: z.string().optional(),
});

const ReasonSchema = z.object({
  text: z.string(),
  evidence: EvidenceSchema,
});

const ConfidenceSchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.enum(["very_high", "high", "medium", "low", "very_low"]),
  missing_data: z.array(z.string()).optional(),
});

const PivotSchema = z
  .object({
    suggestion: z.string(),
    why: z.string(),
  })
  .optional();

const ToneCheckSchema = z.object({
  is_brutal_honest: z.boolean(),
  is_respectful: z.boolean(),
  avoids_jargon: z.boolean(),
});

const ShareableSchema = z
  .object({
    card_title: z.string(),
    card_subtitle: z.string(),
    tweet: z.string(),
  })
  .optional();

const VerdictSchema = z.object({
  verdict: z.enum(["GO", "PIVOT", "DONT"]),
  idea_summary: z.string(),
  reasons: z.array(ReasonSchema).length(3),
  confidence: ConfidenceSchema,
  pivot_suggestion: PivotSchema,
  financials: z
    .object({
      estimated_mvp_cost_monthly_usd: z.number(),
      breakeven_users: z.number().int(),
      suggested_price_usd: z.number(),
      business_model: z.string(),
    })
    .optional(),
  tech_snapshot: z
    .object({
      stack_suggestion: z.string(),
      complexity: z.enum(["simple", "moderate", "complex", "very_complex"]),
      estimated_mvp_weeks: z.number().int(),
    })
    .optional(),
  legal_flags: z
    .array(
      z.object({
        risk: z.string(),
        severity: z.enum(["critical", "high", "medium", "low"]),
        action: z.string(),
      }),
    )
    .optional(),
  tone_check: ToneCheckSchema,
  shareable: ShareableSchema,
});

type Verdict = z.infer<typeof VerdictSchema>;

// --- Request / Response schemas ---

const RequestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
  previousVerdict: z.object({
    idea: z.string(),
    verdict: z.enum(["GO", "PIVOT", "DONT"]),
    confidence: z.number(),
    ideaSummary: z.string(),
  }).optional(),
});

const ErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum([
      "INVALID_INPUT",
      "API_OVERLOAD",
      "VALIDATION_FAILED",
      "TIMEOUT",
      "INTERNAL",
    ]),
    message: z.string(),
    retry_after_ms: z.number().optional(),
  }),
});

const SuccessSchema = z.object({
  ok: z.literal(true),
  data: VerdictSchema,
  meta: z.object({
    model: z.string(),
    duration_ms: z.number(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      cache_read: z.number(),
      cache_write: z.number(),
    }),
    cost_usd: z.number(),
  }),
});

const ApiResponseSchema = z.discriminatedUnion("ok", [SuccessSchema, ErrorSchema]);

// ============================================================
// Helpers
// ============================================================

/** Strip HTML tags from input. Backend JSON-only — full DOMPurify is overkill. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/** Extract JSON from LLM response — handles markdown fences, raw JSON, and edge cases.
 *  Copied verbatim from src/lib/orchestrator/dispatcher.ts (lines 144-197). */
function extractAndParseJSON(text: string): unknown {
  const trimmed = text.trim();

  // Strategy 1: Look for ```json code fence specifically (most reliable)
  const jsonFenceMatch = trimmed.match(/```json\s*\n([\s\S]*?)```/);
  if (jsonFenceMatch) {
    try {
      return JSON.parse(jsonFenceMatch[1].trim());
    } catch {
      // JSON fence found but content is malformed — fall through to other strategies
    }
  }

  // Strategy 2: Raw JSON — starts with { or [
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Might have trailing text after JSON — fall through
    }
  }

  // Strategy 3: Find the outermost JSON structure (first [ or { to matching last ] or })
  // This handles cases where LLM wraps JSON with explanation text
  const firstBrace = trimmed.search(/[{\[]/);
  if (firstBrace !== -1) {
    const opener = trimmed[firstBrace];
    const closer = opener === "{" ? "}" : "]";
    const lastBrace = trimmed.lastIndexOf(closer);
    if (lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        // Fall through
      }
    }
  }

  // Strategy 4: Any code fence (```) — try each one
  const allFences = [...trimmed.matchAll(/```(?:\w*)\s*\n([\s\S]*?)```/g)];
  for (const match of allFences) {
    const content = match[1].trim();
    if (content.startsWith("{") || content.startsWith("[")) {
      try {
        return JSON.parse(content);
      } catch {
        continue;
      }
    }
  }

  throw new Error("No valid JSON structure found in response");
}

function calculateCost(model: string, usage: Anthropic.Messages.Usage): number {
  const pricing = ANTHROPIC_PRICING[model as keyof typeof ANTHROPIC_PRICING];
  if (!pricing) {
    console.warn(`[verdict] Unknown model for pricing: ${model}`);
    return 0;
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const regularInput = Math.max(0, inputTokens - cacheRead - cacheWrite);

  return (
    (regularInput / 1_000_000) * pricing.inputPerMillion +
    (cacheRead / 1_000_000) * pricing.cacheReadPerMillion +
    (cacheWrite / 1_000_000) * pricing.cacheWritePerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

type ErrorCode =
  | "INVALID_INPUT"
  | "API_OVERLOAD"
  | "VALIDATION_FAILED"
  | "TIMEOUT"
  | "INTERNAL";

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  retryAfterMs?: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(retryAfterMs && { retry_after_ms: retryAfterMs }),
      },
    },
    { status },
  );
}

// ============================================================
// Exa Search — market_research tool handler
// ============================================================

// Lazy-init Exa client (only when tool is called)
let exaClient: InstanceType<typeof Exa> | null = null;
function getExaClient(): InstanceType<typeof Exa> {
  if (!exaClient) {
    const key = process.env.EXA_API_KEY;
    if (!key) throw new Error("EXA_API_KEY not configured");
    exaClient = new Exa(key);
  }
  return exaClient;
}

interface MarketResearchInput {
  keywords: string[];
  intent:
    | "validate_demand"
    | "find_competitors"
    | "check_sentiment"
    | "find_pricing";
}

interface MarketResearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    date: string | null;
    relevance: number;
  }>;
  source: "exa_search";
  result_count: number;
}

// ---- legal_check ----

interface LegalCheckInput {
  domain: string
  regions?: string[]
}

interface LegalCheckResult {
  domain: string
  regions: string[]
  risks: Array<{
    area: string
    severity: "critical" | "high" | "medium" | "low"
    description: string
    action_required: string
  }>
  source: "llm_analysis"
}

// ---- finance_calc ----

interface FinanceCalcInput {
  business_model: string
  features: string[]
  target_price?: number
}

interface FinanceCalcResult {
  business_model: string
  estimated_mvp_cost_monthly_usd: number
  breakeven_users: number
  suggested_price_usd: number
  unit_economics_summary: string
  source: "llm_estimate"
}

// ---- tech_feasibility ----

interface TechFeasibilityInput {
  requirements: string[]
}

interface TechFeasibilityResult {
  stack_suggestion: string
  complexity: "simple" | "moderate" | "complex" | "very_complex"
  estimated_mvp_weeks: number
  key_challenges: string[]
  source: "llm_analysis"
}

async function executeMarketResearch(
  input: MarketResearchInput,
): Promise<MarketResearchResult> {
  const exa = getExaClient();

  // Build search query from keywords + intent
  const intentPrefix: Record<string, string> = {
    validate_demand: "user demand pain points for",
    find_competitors: "competitors alternatives to",
    check_sentiment: "user reviews opinions about",
    find_pricing: "pricing plans cost of",
  };
  const query = `${intentPrefix[input.intent] ?? ""} ${input.keywords.join(" ")}`.trim();

  try {
    const searchResults = await exa.searchAndContents(query, {
      numResults: 5,
      text: { maxCharacters: 300 },
      type: "auto",
    });

    return {
      query,
      results: searchResults.results.map((r) => ({
        title: r.title ?? "Untitled",
        url: r.url,
        snippet: (r.text ?? "").slice(0, 300),
        date: r.publishedDate ?? null,
        relevance: r.score ?? 0,
      })),
      source: "exa_search",
      result_count: searchResults.results.length,
    };
  } catch (err) {
    // Don't leak API details in error
    console.error(
      "[verdict] Exa search failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return {
      query,
      results: [],
      source: "exa_search",
      result_count: 0,
    };
  }
}

// ============================================================
// Local tool handlers (no external API calls)
// ============================================================

function executeLegalCheck(input: LegalCheckInput): LegalCheckResult {
  // Local tool — no API call. The LLM already analyzed legal risks
  // when it composed the tool_use input. We package it as structured data.
  const regions = input.regions ?? ["US"]

  return {
    domain: input.domain,
    regions,
    risks: [
      {
        area: `${input.domain} regulatory compliance`,
        severity: "medium",
        description: `Operating in ${input.domain} requires compliance review for ${regions.join(", ")}`,
        action_required: "Consult a lawyer specializing in " + input.domain,
      },
    ],
    source: "llm_analysis",
  }
}

function executeFinanceCalc(input: FinanceCalcInput): FinanceCalcResult {
  // Heuristic-based MVP cost estimation
  const featureCount = input.features.length
  const baseMonthly = input.business_model === "saas" ? 500
    : input.business_model === "marketplace" ? 800
    : input.business_model === "ecommerce" ? 600
    : input.business_model === "hardware" ? 1500
    : 400

  const estimatedCost = baseMonthly + (featureCount * 200)
  const suggestedPrice = input.target_price ?? (input.business_model === "saas" ? 15 : 29)
  const breakeven = Math.ceil(estimatedCost / suggestedPrice)

  return {
    business_model: input.business_model,
    estimated_mvp_cost_monthly_usd: estimatedCost,
    breakeven_users: breakeven,
    suggested_price_usd: suggestedPrice,
    unit_economics_summary: `${featureCount} features, $${estimatedCost}/mo infra, need ${breakeven} users at $${suggestedPrice}/mo to break even`,
    source: "llm_estimate",
  }
}

function executeTechFeasibility(input: TechFeasibilityInput): TechFeasibilityResult {
  // Complexity heuristic based on requirement count and keywords
  const reqs = input.requirements
  const hasRealtime = reqs.some(r => /real-?time|websocket|live/i.test(r))
  const hasAI = reqs.some(r => /ai|ml|machine.?learn|llm|gpt|model/i.test(r))
  const hasPayments = reqs.some(r => /payment|stripe|billing|subscription/i.test(r))
  const hasVideo = reqs.some(r => /video|stream|media/i.test(r))

  const complexFactors = [hasRealtime, hasAI, hasPayments, hasVideo].filter(Boolean).length
  const complexity: TechFeasibilityResult["complexity"] =
    reqs.length <= 2 && complexFactors === 0 ? "simple"
    : reqs.length <= 4 && complexFactors <= 1 ? "moderate"
    : reqs.length <= 6 && complexFactors <= 2 ? "complex"
    : "very_complex"

  const weeksMap = { simple: 4, moderate: 8, complex: 14, very_complex: 24 }

  const challenges: string[] = []
  if (hasRealtime) challenges.push("Real-time infrastructure (WebSockets, presence)")
  if (hasAI) challenges.push("AI/ML integration (model selection, latency, cost)")
  if (hasPayments) challenges.push("Payment processing (PCI compliance, Stripe integration)")
  if (hasVideo) challenges.push("Video/streaming infrastructure (encoding, CDN, bandwidth)")

  return {
    stack_suggestion: "Next.js + React + Supabase + Vercel" + (hasAI ? " + Claude API" : "") + (hasPayments ? " + Stripe" : ""),
    complexity,
    estimated_mvp_weeks: weeksMap[complexity],
    key_challenges: challenges.length > 0 ? challenges : ["Standard web application — no major technical risks"],
    source: "llm_analysis",
  }
}

// ============================================================
// Tool extraction from prompt config
// ============================================================

// Extract all tool definitions from prompt config
const TOOL_DEFINITIONS = promptConfig.tools.map(
  (t: { name: string; description: string; input_schema: Record<string, unknown> }) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema,
  }),
)

// Build the tools array for the API call
// market_research requires EXA_API_KEY; the other 3 are always available
function getActiveTools(): Anthropic.Messages.Tool[] {
  if (process.env.EXA_API_KEY) {
    // All 4 tools available
    return TOOL_DEFINITIONS
  }
  // No Exa key — only local tools (legal, finance, tech)
  return TOOL_DEFINITIONS.filter((t) => t.name !== "market_research")
}

// ============================================================
// Anthropic call with tool-use loop
// ============================================================

async function callAnthropicWithTools(
  client: Anthropic,
  idea: string,
  previousVerdict?: {
    idea: string
    verdict: "GO" | "PIVOT" | "DONT"
    confidence: number
    ideaSummary: string
  },
): Promise<{ verdict: Verdict; usage: Anthropic.Messages.Usage }> {
  const tools = getActiveTools();

  let userMessage: string
  if (previousVerdict) {
    userMessage =
      `## PREVIOUS COUNCIL VERDICT (for comparison)\n\n` +
      `Idea submitted: "${previousVerdict.idea}"\n` +
      `Verdict: ${previousVerdict.verdict}\n` +
      `Confidence: ${previousVerdict.confidence}%\n` +
      `Summary: "${previousVerdict.ideaSummary}"\n\n` +
      `The user has now UPDATED their idea. Compare with the previous version and note what changed, what improved, and what still needs work. If the verdict changes, explain WHY it changed.\n\n` +
      `## CURRENT IDEA (evaluate this)\n\n${idea}`
  } else {
    userMessage = `Evaluate this idea and respond with valid JSON only:\n\n${idea}`
  }

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: userMessage,
    },
  ];

  const totalUsage: Anthropic.Messages.Usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_creation: null,
    inference_geo: null,
    server_tool_use: null,
    service_tier: null,
  };

  // Max 3 turns: initial + tool results + possible second tool round
  for (let turn = 0; turn < 3; turn++) {
    const response = await client.messages.create({
      model: promptConfig.meta.model,
      max_tokens: promptConfig.meta.max_tokens,
      temperature: promptConfig.meta.temperature,
      system: [
        {
          type: "text",
          text: SYSTEM_TEXT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
      tools,
    });

    // Accumulate token usage
    totalUsage.input_tokens += response.usage.input_tokens;
    totalUsage.output_tokens += response.usage.output_tokens;
    totalUsage.cache_read_input_tokens =
      (totalUsage.cache_read_input_tokens ?? 0) +
      (response.usage.cache_read_input_tokens ?? 0);
    totalUsage.cache_creation_input_tokens =
      (totalUsage.cache_creation_input_tokens ?? 0) +
      (response.usage.cache_creation_input_tokens ?? 0);

    // Check if model wants to use a tool
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUseBlocks.length > 0 && response.stop_reason === "tool_use") {
      // Execute tools and collect results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        let resultContent: string

        if (toolBlock.name === "market_research") {
          const result = await executeMarketResearch(
            toolBlock.input as MarketResearchInput,
          )
          console.log(
            `[verdict] Exa search: "${result.query}" → ${result.result_count} results`,
          )
          resultContent = JSON.stringify(result)
        } else if (toolBlock.name === "legal_check") {
          const result = executeLegalCheck(toolBlock.input as LegalCheckInput)
          console.log(`[verdict] Legal check: domain=${result.domain}, regions=${result.regions.join(",")}`)
          resultContent = JSON.stringify(result)
        } else if (toolBlock.name === "finance_calc") {
          const result = executeFinanceCalc(toolBlock.input as FinanceCalcInput)
          console.log(`[verdict] Finance calc: model=${result.business_model}, cost=$${result.estimated_mvp_cost_monthly_usd}/mo`)
          resultContent = JSON.stringify(result)
        } else if (toolBlock.name === "tech_feasibility") {
          const result = executeTechFeasibility(toolBlock.input as TechFeasibilityInput)
          console.log(`[verdict] Tech feasibility: complexity=${result.complexity}, weeks=${result.estimated_mvp_weeks}`)
          resultContent = JSON.stringify(result)
        } else {
          // Truly unknown tool
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ error: `Tool ${toolBlock.name} not implemented` }),
            is_error: true,
          })
          continue
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: resultContent,
        })
      }

      // Add assistant message + tool results to conversation
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      continue; // next turn — LLM sees tool results and writes verdict
    }

    // No tool use — extract verdict from text
    const textContent = response.content.find(
      (c): c is Anthropic.Messages.TextBlock => c.type === "text",
    );
    if (!textContent) {
      throw new Error("No text content in response");
    }

    const parsed = extractAndParseJSON(textContent.text);
    const result = VerdictSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `VALIDATION_FAILED: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }

    return { verdict: result.data, usage: totalUsage };
  }

  // Should never reach here (max 2 turns), but safety fallback
  throw new Error("VALIDATION_FAILED: Max tool turns exceeded");
}

// ============================================================
// Error mapping
// ============================================================

function handleAnthropicError(err: unknown): NextResponse {
  console.error("[verdict] Anthropic call failed:", err);

  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) {
      const retryHeader = err.headers?.["retry-after"];
      const retryAfter = parseInt(retryHeader ?? "60", 10) * 1000;
      return errorResponse("API_OVERLOAD", "Rate limited by Anthropic", 503, retryAfter);
    }
    if (err.status === 529) {
      return errorResponse(
        "API_OVERLOAD",
        "Anthropic temporarily overloaded",
        503,
        5000,
      );
    }
    if (err.status === 400) {
      return errorResponse("INTERNAL", "Bad request to AI provider", 500);
    }
  }

  if (err instanceof Error && err.message.startsWith("VALIDATION_FAILED")) {
    return errorResponse("VALIDATION_FAILED", "AI returned invalid output after retry", 502);
  }

  return errorResponse("INTERNAL", "Unexpected error", 500);
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Parse body — guard against malformed JSON
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Request body must be valid JSON", 400);
  }

  // Validate input shape
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid input",
      400,
    );
  }

  // Rate limiting — before expensive Anthropic call
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitResult = await checkRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Rate limit exceeded. Maximum 10 verdicts per day.",
        resetsAt: rateLimitResult.resetsAt.toISOString(),
      },
      { status: 429 },
    );
  }

  const idea = stripHtml(parsed.data.idea);
  if (idea.length < 10) {
    return errorResponse("INVALID_INPUT", "Idea too short after sanitization", 400);
  }

  // Call Anthropic with tool-use loop
  let verdict: Verdict;
  let usage: Anthropic.Messages.Usage;
  try {
    const client = new Anthropic();
    const result = await callAnthropicWithTools(client, idea, parsed.data.previousVerdict);
    verdict = result.verdict;
    usage = result.usage;
  } catch (err) {
    return handleAnthropicError(err);
  }

  // Build response
  const duration = Date.now() - startTime;
  const cost = calculateCost(promptConfig.meta.model, usage);

  // Structured logging
  console.log(
    JSON.stringify({
      event: "verdict_generated",
      duration_ms: duration,
      cost_usd: cost,
      verdict: verdict.verdict,
      confidence: verdict.confidence.score,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    }),
  );

  const response = {
    ok: true as const,
    data: verdict,
    meta: {
      model: promptConfig.meta.model,
      duration_ms: duration,
      tokens: {
        input: usage.input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
        cache_read: usage.cache_read_input_tokens ?? 0,
        cache_write: usage.cache_creation_input_tokens ?? 0,
      },
      cost_usd: cost,
    },
  };

  // Self-validate response shape — catches accidental drift
  const validated = ApiResponseSchema.safeParse(response);
  if (!validated.success) {
    console.error("[verdict] Response failed self-validation:", validated.error);
    return errorResponse("INTERNAL", "Response shape error", 500);
  }

  return NextResponse.json(response);
}
