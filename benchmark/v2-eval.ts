/**
 * Council v2 Eval — Prompt Quality Test Harness
 *
 * Runs 20 golden test cases against the v2 system prompt via Claude API.
 * Checks: schema validity, verdict accuracy, confidence calibration,
 * red flags, reason count, pivot suggestions, missing data, tone.
 *
 * Usage:
 *   npx tsx benchmark/v2-eval.ts              # all 20 cases
 *   npx tsx benchmark/v2-eval.ts GT-05        # single test by ID
 *   npx tsx benchmark/v2-eval.ts clear_dont   # filter by category
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Load .env.local
const envPath = join(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ============================================================
// Section 2: Zod Schemas (from v2-output-schema.json)
// ============================================================

const EvidenceSchema = z.object({
  type: z.enum(["market_data", "competitor", "financial", "technical", "legal", "pattern", "training_data", "assumption"]),
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

const PivotSchema = z.object({
  suggestion: z.string(),
  why: z.string(),
});

const ToneCheckSchema = z.object({
  is_brutal_honest: z.boolean(),
  is_respectful: z.boolean(),
  avoids_jargon: z.boolean(),
});

const VerdictSchema = z.object({
  verdict: z.enum(["GO", "PIVOT", "DONT"]),
  idea_summary: z.string(),
  reasons: z.array(ReasonSchema),
  confidence: ConfidenceSchema,
  pivot_suggestion: PivotSchema.nullable().optional(),
  financials: z.object({
    estimated_mvp_cost_monthly_usd: z.number(),
    breakeven_users: z.number().int(),
    suggested_price_usd: z.number(),
    business_model: z.string(),
  }).optional(),
  tech_snapshot: z.object({
    stack_suggestion: z.string(),
    complexity: z.enum(["simple", "moderate", "complex", "very_complex"]),
    estimated_mvp_weeks: z.number().int(),
  }).optional(),
  legal_flags: z.array(z.object({
    risk: z.string(),
    severity: z.enum(["critical", "high", "medium", "low"]),
    action: z.string(),
  })).optional(),
  tone_check: ToneCheckSchema,
  shareable: z.object({
    card_title: z.string(),
    card_subtitle: z.string(),
    tweet: z.string(),
  }).optional(),
});

type Verdict = z.infer<typeof VerdictSchema>;

// ============================================================
// Section 3: Types
// ============================================================

interface TestCase {
  id: string;
  category: string;
  input: string;
  expected_verdict: "GO" | "PIVOT" | "DONT";
  expected_confidence_range: [number, number];
  quality_notes: string;
  red_flags_if_output_contains: string[];
}

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface TestResult {
  id: string;
  category: string;
  input: string;
  expected_verdict: string;
  actual_verdict: string | null;
  confidence: { score: number; label: string } | null;
  checks: CheckResult[];
  raw_output: Record<string, unknown> | null;
  raw_text: string;
  timing_ms: number;
  tokens: { input: number; output: number; cache_read: number; cache_write: number };
  cost_usd: number;
  error: string | null;
  human_review: {
    reasons_quality: number | null;
    tone: number | null;
    actionable: number | null;
    would_share: number | null;
  };
}

// ============================================================
// Section 4: Automated Checks
// ============================================================

function runChecks(
  parsed: Verdict | null,
  rawText: string,
  testCase: TestCase,
  schemaError: string | null
): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. Schema valid
  if (!parsed || schemaError) {
    checks.push({ name: "schema_valid", passed: false, detail: schemaError || "JSON parse failed" });
    // Skip remaining checks — no valid data
    checks.push({ name: "verdict_correct", passed: false, detail: "skipped: schema invalid" });
    checks.push({ name: "confidence_calibrated", passed: false, detail: "skipped: schema invalid" });
    checks.push({ name: "no_red_flags", passed: false, detail: "skipped: schema invalid" });
    checks.push({ name: "3_reasons", passed: false, detail: "skipped: schema invalid" });
    checks.push({ name: "pivot_has_suggestion", passed: false, detail: "skipped: schema invalid" });
    checks.push({ name: "low_conf_missing_data", passed: false, detail: "skipped: schema invalid" });
    checks.push({ name: "tone_self_check", passed: false, detail: "skipped: schema invalid" });
    return checks;
  }

  checks.push({ name: "schema_valid", passed: true, detail: "OK" });

  // 2. Verdict correct
  const verdictMatch = parsed.verdict === testCase.expected_verdict;
  checks.push({
    name: "verdict_correct",
    passed: verdictMatch,
    detail: verdictMatch
      ? `${parsed.verdict} (correct)`
      : `expected ${testCase.expected_verdict}, got ${parsed.verdict}`,
  });

  // 3. Confidence calibrated
  const [min, max] = testCase.expected_confidence_range;
  const score = parsed.confidence.score;
  const calibrated = score >= min && score <= max;
  checks.push({
    name: "confidence_calibrated",
    passed: calibrated,
    detail: calibrated
      ? `${score} in [${min}-${max}]`
      : `${score} outside [${min}-${max}]`,
  });

  // 4. No red flags
  const outputLower = JSON.stringify(parsed).toLowerCase();
  const foundFlags = testCase.red_flags_if_output_contains.filter(
    (flag) => outputLower.includes(flag.toLowerCase())
  );
  checks.push({
    name: "no_red_flags",
    passed: foundFlags.length === 0,
    detail: foundFlags.length === 0
      ? "clean"
      : `found: ${foundFlags.map((f) => `"${f}"`).join(", ")}`,
  });

  // 5. Exactly 3 reasons
  const reasonCount = parsed.reasons.length;
  checks.push({
    name: "3_reasons",
    passed: reasonCount === 3,
    detail: reasonCount === 3 ? "3 reasons" : `${reasonCount} reasons (expected 3)`,
  });

  // 6. Pivot has suggestion (only when verdict is PIVOT)
  if (parsed.verdict === "PIVOT") {
    const hasSuggestion = !!parsed.pivot_suggestion?.suggestion;
    checks.push({
      name: "pivot_has_suggestion",
      passed: hasSuggestion,
      detail: hasSuggestion ? "present" : "MISSING pivot_suggestion for PIVOT verdict",
    });
  } else {
    checks.push({ name: "pivot_has_suggestion", passed: true, detail: "n/a (not PIVOT)" });
  }

  // 7. Low confidence must have missing_data
  if (parsed.confidence.score < 60) {
    const hasMissing =
      Array.isArray(parsed.confidence.missing_data) &&
      parsed.confidence.missing_data.length > 0;
    checks.push({
      name: "low_conf_missing_data",
      passed: hasMissing,
      detail: hasMissing
        ? `${parsed.confidence.missing_data!.length} items listed`
        : "MISSING missing_data for confidence < 60",
    });
  } else {
    checks.push({ name: "low_conf_missing_data", passed: true, detail: "n/a (confidence >= 60)" });
  }

  // 8. Tone self-check
  const tone = parsed.tone_check;
  const toneOk = tone.is_brutal_honest && tone.is_respectful && tone.avoids_jargon;
  checks.push({
    name: "tone_self_check",
    passed: toneOk,
    detail: toneOk
      ? "all true"
      : `brutal=${tone.is_brutal_honest} respectful=${tone.is_respectful} jargon=${tone.avoids_jargon}`,
  });

  return checks;
}

// ============================================================
// Section 5: API Call + Retry
// ============================================================

// Load prompt config once
const PROMPT_CONFIG = JSON.parse(
  readFileSync(join(__dirname, "../prompts/v2-system-prompt.json"), "utf-8")
);
const SCHEMA_CONFIG = JSON.parse(
  readFileSync(join(__dirname, "../prompts/v2-output-schema.json"), "utf-8")
);

const MODEL = PROMPT_CONFIG.meta.model;
const MAX_TOKENS = PROMPT_CONFIG.meta.max_tokens;
const TEMPERATURE = PROMPT_CONFIG.meta.temperature;

const client = new Anthropic();

// Pricing (Sonnet 4.6)
const PRICING = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
  cacheWritePerMillion: 3.75,
  cacheReadPerMillion: 0.30,
};

function calcCost(input: number, output: number, cacheRead: number, cacheWrite: number): number {
  const regularInput = Math.max(0, input - cacheRead - cacheWrite);
  return (
    (regularInput / 1_000_000) * PRICING.inputPerMillion +
    (cacheRead / 1_000_000) * PRICING.cacheReadPerMillion +
    (cacheWrite / 1_000_000) * PRICING.cacheWritePerMillion +
    (output / 1_000_000) * PRICING.outputPerMillion
  );
}

// Build the system prompt with schema appended
const SYSTEM_TEXT =
  PROMPT_CONFIG.system_prompt +
  "\n\n## OUTPUT SCHEMA\n\nYou MUST respond with valid JSON matching this exact schema:\n\n```json\n" +
  JSON.stringify(SCHEMA_CONFIG.verdict_schema, null, 2) +
  "\n```";

// Convert tools to Anthropic SDK format
const TOOLS: Anthropic.Tool[] = PROMPT_CONFIG.tools.map(
  (t: { name: string; description: string; input_schema: Record<string, unknown> }) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  })
);

async function callClaude(
  userMessage: string,
  retry = true
): Promise<{
  rawText: string;
  parsed: Verdict | null;
  schemaError: string | null;
  toolUseWarning: boolean;
  tokens: { input: number; output: number; cache_read: number; cache_write: number };
  costUsd: number;
  durationMs: number;
}> {
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: [
        {
          type: "text" as const,
          text: SYSTEM_TEXT,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      // Tools omitted: eval tests verdict JSON output only; tools aren't implemented here
      messages: [{ role: "user", content: userMessage }],
    });

    const durationMs = Date.now() - start;

    // Check for tool_use blocks
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUseWarning = toolUseBlocks.length > 0;

    const rawText = textBlocks.map((b) => (b as { text: string }).text).join("\n");

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cacheRead = (response.usage as Record<string, number>).cache_read_input_tokens ?? 0;
    const cacheWrite = (response.usage as Record<string, number>).cache_creation_input_tokens ?? 0;
    const costUsd = calcCost(inputTokens, outputTokens, cacheRead, cacheWrite);

    // Parse JSON
    let parsed: Verdict | null = null;
    let schemaError: string | null = null;

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    try {
      const json = JSON.parse(cleaned);
      const result = VerdictSchema.safeParse(json);
      if (result.success) {
        parsed = result.data;
      } else {
        schemaError = (result as { error?: { issues?: Array<{ path: Array<string | number>; message: string }> } }).error?.issues
          ?.map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ") ?? "Schema validation failed";
      }
    } catch (e) {
      schemaError = `JSON parse error: ${e instanceof Error ? e.message : String(e)}`;
    }

    return {
      rawText,
      parsed,
      schemaError,
      toolUseWarning,
      tokens: { input: inputTokens, output: outputTokens, cache_read: cacheRead, cache_write: cacheWrite },
      costUsd,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);

    // Retry once on rate limit or server error
    if (retry && err instanceof Anthropic.APIError && (err.status === 429 || err.status >= 500)) {
      console.log(`    [retry] ${err.status} — waiting 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      return callClaude(userMessage, false);
    }

    throw new Error(`API call failed (${durationMs}ms): ${errMsg}`);
  }
}

// ============================================================
// Section 6: Reporter
// ============================================================

const RESULTS_DIR = join(__dirname, "results");

function printCaseResult(index: number, total: number, testCase: TestCase, result: TestResult) {
  const verdict = result.actual_verdict ?? "ERROR";
  const conf = result.confidence?.score ?? "?";
  const secs = (result.timing_ms / 1000).toFixed(1);

  console.log(
    `\n[${String(index + 1).padStart(2, "0")}/${total}] ${testCase.id} (${testCase.category})`
  );

  if (result.error) {
    console.log(`  ERROR: ${result.error}`);
    return;
  }

  console.log(`  -> ${verdict} (confidence: ${conf}) -- ${secs}s`);

  const line = result.checks
    .map((c) => (c.passed ? `  \u2713 ${c.name}` : `  \u2717 ${c.name}`))
    .join("");
  console.log(line);

  // Show failures inline
  for (const c of result.checks) {
    if (!c.passed && c.detail !== "skipped: schema invalid") {
      console.log(`    ^ ${c.name}: ${c.detail}`);
    }
  }
}

function printSummary(results: TestResult[]) {
  const total = results.length;
  const verdictCorrect = results.filter(
    (r) => r.checks.find((c) => c.name === "verdict_correct")?.passed
  ).length;
  const allChecks = results.flatMap((r) => r.checks);
  const totalChecks = allChecks.length;
  const passedChecks = allChecks.filter((c) => c.passed).length;
  const schemaValid = results.filter(
    (r) => r.checks.find((c) => c.name === "schema_valid")?.passed
  ).length;
  const redFlagFailures = results.filter(
    (r) => !r.checks.find((c) => c.name === "no_red_flags")?.passed
  ).length;
  const totalCost = results.reduce((s, r) => s + r.cost_usd, 0);
  const totalInput = results.reduce((s, r) => s + r.tokens.input, 0);
  const totalOutput = results.reduce((s, r) => s + r.tokens.output, 0);

  console.log("\n" + "=".repeat(70));
  console.log("COUNCIL v2 EVAL SUMMARY");
  console.log("=".repeat(70));
  console.log(`Verdict accuracy:    ${verdictCorrect}/${total} (${((verdictCorrect / total) * 100).toFixed(0)}%)`);
  console.log(`Check pass rate:     ${passedChecks}/${totalChecks} (${((passedChecks / totalChecks) * 100).toFixed(1)}%)`);
  console.log(`Schema valid:        ${schemaValid}/${total}`);
  console.log(`Red flags found:     ${redFlagFailures}`);

  // List failures
  const failures = results.filter((r) => r.checks.some((c) => !c.passed));
  if (failures.length > 0) {
    console.log(`\nFAILURES:`);
    for (const r of failures) {
      const failedChecks = r.checks.filter((c) => !c.passed);
      for (const c of failedChecks) {
        console.log(`  ${r.id}: ${c.name} -- ${c.detail}`);
      }
    }
  }

  console.log(
    `\nCost: ~$${totalCost.toFixed(3)} (input: ${(totalInput / 1000).toFixed(1)}K, output: ${(totalOutput / 1000).toFixed(1)}K tokens)`
  );
  console.log("=".repeat(70));
}

// ============================================================
// Section 7: Main Runner
// ============================================================

async function main() {
  const filter = process.argv[2];

  // Load test cases
  const goldenTests = JSON.parse(
    readFileSync(join(__dirname, "../prompts/v2-golden-tests.json"), "utf-8")
  );
  let testCases: TestCase[] = goldenTests.test_cases;

  // Apply filter
  if (filter) {
    testCases = testCases.filter(
      (t) =>
        t.id.toLowerCase().includes(filter.toLowerCase()) ||
        t.category.toLowerCase().includes(filter.toLowerCase())
    );
    if (testCases.length === 0) {
      console.error(`No test cases match filter: "${filter}"`);
      process.exit(1);
    }
  }

  console.log(`Council v2 Eval — ${testCases.length} test case(s)`);
  console.log(`Model: ${MODEL} | Temp: ${TEMPERATURE} | Max tokens: ${MAX_TOKENS}`);
  console.log("=".repeat(70));

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const results: TestResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    let result: TestResult;

    try {
      const apiResult = await callClaude(tc.input);

      if (apiResult.toolUseWarning) {
        console.log(`  [WARN] ${tc.id}: Model returned tool_use blocks — prompt may need stronger JSON instruction`);
      }

      const checks = runChecks(apiResult.parsed, apiResult.rawText, tc, apiResult.schemaError);

      result = {
        id: tc.id,
        category: tc.category,
        input: tc.input,
        expected_verdict: tc.expected_verdict,
        actual_verdict: apiResult.parsed?.verdict ?? null,
        confidence: apiResult.parsed?.confidence
          ? { score: apiResult.parsed.confidence.score, label: apiResult.parsed.confidence.label }
          : null,
        checks,
        raw_output: apiResult.parsed as unknown as Record<string, unknown> | null,
        raw_text: apiResult.rawText,
        timing_ms: apiResult.durationMs,
        tokens: apiResult.tokens,
        cost_usd: apiResult.costUsd,
        error: apiResult.schemaError && !apiResult.parsed ? apiResult.schemaError : null,
        human_review: {
          reasons_quality: null,
          tone: null,
          actionable: null,
          would_share: null,
        },
      };
    } catch (err) {
      result = {
        id: tc.id,
        category: tc.category,
        input: tc.input,
        expected_verdict: tc.expected_verdict,
        actual_verdict: null,
        confidence: null,
        checks: [],
        raw_output: null,
        raw_text: "",
        timing_ms: 0,
        tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0 },
        cost_usd: 0,
        error: err instanceof Error ? err.message : String(err),
        human_review: {
          reasons_quality: null,
          tone: null,
          actionable: null,
          would_share: null,
        },
      };
    }

    results.push(result);
    printCaseResult(i, testCases.length, tc, result);
  }

  printSummary(results);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `v2-eval-${timestamp}.json`;
  const filePath = join(RESULTS_DIR, fileName);

  const output = {
    meta: {
      timestamp: new Date().toISOString(),
      model: MODEL,
      prompt_version: PROMPT_CONFIG.meta.version,
      total_cases: testCases.length,
      verdict_accuracy: `${results.filter((r) => r.checks.find((c) => c.name === "verdict_correct")?.passed).length}/${testCases.length}`,
      check_pass_rate: `${results.flatMap((r) => r.checks).filter((c) => c.passed).length}/${results.flatMap((r) => r.checks).length}`,
      filter: filter || null,
    },
    results,
  };

  writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${filePath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
