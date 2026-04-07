// TODO(v2.1): Add rate limiting via Upstash Redis when we have >100 daily users.
// In-memory Map does not work on Vercel serverless cold starts.
// See: https://upstash.com/docs/redis/sdks/ratelimit-ts

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
  text: z.string().max(200),
  evidence: EvidenceSchema,
});

const ConfidenceSchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.enum(["very_high", "high", "medium", "low", "very_low"]),
  missing_data: z.array(z.string()).optional(),
});

const PivotSchema = z
  .object({
    suggestion: z.string().max(200),
    why: z.string().max(200),
  })
  .optional();

const ToneCheckSchema = z.object({
  is_brutal_honest: z.boolean(),
  is_respectful: z.boolean(),
  avoids_jargon: z.boolean(),
});

const ShareableSchema = z
  .object({
    card_title: z.string().max(60),
    card_subtitle: z.string().max(120),
    tweet: z.string().max(280),
  })
  .optional();

const VerdictSchema = z.object({
  verdict: z.enum(["GO", "PIVOT", "DONT"]),
  idea_summary: z.string().max(100),
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
// Anthropic call with retry
// ============================================================

type CallResult =
  | { ok: true; verdict: Verdict; usage: Anthropic.Messages.Usage; kind: "success" }
  | { ok: false; kind: "validation_failed"; errors: string[] }
  | { ok: false; kind: "api_error"; error: Error };

async function callAnthropicOnce(
  client: Anthropic,
  idea: string,
  isRetry: boolean,
  prevErrors?: string[],
): Promise<CallResult> {
  const userMessage = isRetry
    ? `Your previous response failed schema validation. Errors: ${prevErrors?.join("; ") ?? "unknown"}. ` +
      `Respond with valid JSON only, matching the schema exactly. No markdown, no explanation outside JSON.\n\n` +
      `Evaluate this idea:\n\n${idea}`
    : `Evaluate this idea and respond with valid JSON only:\n\n${idea}`;

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create({
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
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    return { ok: false, kind: "api_error", error: err as Error };
  }

  // Extract text content
  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return {
      ok: false,
      kind: "api_error",
      error: new Error("No text content in response"),
    };
  }

  // Extract & parse JSON
  let parsed: unknown;
  try {
    parsed = extractAndParseJSON(textContent.text);
  } catch (err) {
    return {
      ok: false,
      kind: "validation_failed",
      errors: [
        `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Validate against schema
  const result = VerdictSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      kind: "validation_failed",
      errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  return { ok: true, kind: "success", verdict: result.data, usage: response.usage };
}

async function callAnthropicWithRetry(idea: string): Promise<{
  verdict: Verdict;
  usage: Anthropic.Messages.Usage;
}> {
  const client = new Anthropic();

  // Attempt 1: standard request
  const attempt1 = await callAnthropicOnce(client, idea, false);
  if (attempt1.ok) return { verdict: attempt1.verdict, usage: attempt1.usage };

  // Attempt 2: validation failed → retry with corrective message
  if (attempt1.kind === "validation_failed") {
    const attempt2 = await callAnthropicOnce(client, idea, true, attempt1.errors);
    if (attempt2.ok) return { verdict: attempt2.verdict, usage: attempt2.usage };
    const errs =
      attempt2.kind === "validation_failed" ? attempt2.errors.join("; ") : "unknown";
    throw new Error(`VALIDATION_FAILED: ${errs}`);
  }

  // Other failure types propagate up
  throw attempt1.error;
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

  const idea = stripHtml(parsed.data.idea);
  if (idea.length < 10) {
    return errorResponse("INVALID_INPUT", "Idea too short after sanitization", 400);
  }

  // Call Anthropic with retry logic
  let verdict: Verdict;
  let usage: Anthropic.Messages.Usage;
  try {
    const result = await callAnthropicWithRetry(idea);
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
