/**
 * Council v2 Bias Test — WITH TOOLS (Exa-enabled)
 *
 * Mirror of bias-test.ts but with market_research / legal_check / finance_calc /
 * tech_feasibility tools enabled in the Anthropic call. This reproduces the
 * production code path where Exa search results bias the model toward PIVOT
 * at anchor 72% even for absurd inputs.
 *
 * Tool behavior:
 *   - market_research: calls Exa API if EXA_API_KEY is set; otherwise returns a
 *     deterministic fake result ({ results: [{ title, url: https://example.com/fake, snippet }] })
 *     so the anchor bug can be reproduced without burning Exa quota.
 *   - legal_check / finance_calc / tech_feasibility: local heuristic handlers
 *     copied inline from src/app/api/verdict/route.ts (benchmark/ is excluded
 *     from tsconfig, so we avoid the @/ alias by duplicating minimal stubs).
 *
 * Usage:
 *   npx tsx benchmark/bias-test-exa.ts                        # 12 × 3 = 36 calls
 *   npx tsx benchmark/bias-test-exa.ts --runs 1               # smoke
 *   npx tsx benchmark/bias-test-exa.ts --filter bad --runs 1  # baseline repro
 *   npx tsx benchmark/bias-test-exa.ts --tag prefix            # label output file
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const envPath = join(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// --- Schemas (mirror bias-test.ts) ---

const EvidenceSchema = z.object({
  type: z.enum([
    "market_data", "competitor", "financial", "technical",
    "legal", "pattern", "training_data", "assumption",
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

const VerdictSchema = z.object({
  verdict: z.enum(["GO", "PIVOT", "DONT"]),
  idea_summary: z.string(),
  reasons: z.array(ReasonSchema),
  confidence: ConfidenceSchema,
}).passthrough();

type Verdict = z.infer<typeof VerdictSchema>;

// --- Probes: identical to bias-test.ts (12 probes, 4 per bucket) ---

type Bucket = "bad" | "good" | "pivot";

interface Probe {
  id: string;
  bucket: Bucket;
  expected: "GO" | "PIVOT" | "DONT";
  input: string;
  note: string;
}

const PROBES: Probe[] = [
  {
    id: "B1", bucket: "bad", expected: "DONT",
    input: "Blockchain tabanlı DAO ile sokak kedilerine şeffaf bağış ve mama dağıtım sistemi",
    note: "Absurd control — live test already returned PIVOT 72%",
  },
  {
    id: "B2", bucket: "bad", expected: "DONT",
    input: "Instagram clone yapmak istiyorum",
    note: "Compete with Meta on their core product",
  },
  {
    id: "B3", bucket: "bad", expected: "DONT",
    input: "bir uygulama yapmak istiyorum",
    note: "Vague — no idea to evaluate",
  },
  {
    id: "B4", bucket: "bad", expected: "DONT",
    input: "NFT-based appointment reminder app where each reminder is a unique tradeable token",
    note: "Mechanism / category mismatch, no real pain",
  },
  {
    id: "G1", bucket: "good", expected: "GO",
    input: "Bug tracker for SOLO developers — no boards, just a prioritized list",
    note: "Named wedge: solo devs underserved",
  },
  {
    id: "G2", bucket: "good", expected: "GO",
    input: "AI tutor for K-12 math — parents pay, personalized per student level",
    note: "Real pain, AI enables it, parents pay",
  },
  {
    id: "G3", bucket: "good", expected: "GO",
    input: "Self-hosted GitHub Copilot using local LLMs — zero data sent to cloud, for enterprises with IP concerns",
    note: "Named wedge: local/privacy — Copilot can't ship this",
  },
  {
    id: "G4", bucket: "good", expected: "GO",
    input: "I want to build a tool that converts Figma designs to production React code with 1:1 accuracy",
    note: "Hot market, existing traction proves demand",
  },
  {
    id: "P1", bucket: "pivot", expected: "PIVOT",
    input: "Open source alternative to Vercel for self-hosting Next.js apps",
    note: "No wedge — Coolify, OpenNext exist",
  },
  {
    id: "P2", bucket: "pivot", expected: "PIVOT",
    input: "Online pharmacy where people can order prescription drugs with same-day delivery",
    note: "Regulated — pivot to OTC/telehealth",
  },
  {
    id: "P3", bucket: "pivot", expected: "PIVOT",
    input: "Türkiye'deki halı sahalar için oyuncu eşleştirme ve rezervasyon uygulaması",
    note: "SahaCepte exists; narrow to missing-player matchmaking",
  },
  {
    id: "P4", bucket: "pivot", expected: "PIVOT",
    input: "Yapay zeka ile herkesin kendi podcast'ini otomatik oluşturabileceği bir platform",
    note: "'Everyone' is wrong target — niche down",
  },
];

// --- Prompt + tools setup ---

const PROMPT_CONFIG = JSON.parse(
  readFileSync(join(__dirname, "../prompts/v2-system-prompt.json"), "utf-8")
);
const SCHEMA_CONFIG = JSON.parse(
  readFileSync(join(__dirname, "../prompts/v2-output-schema.json"), "utf-8")
);

const MODEL: string = PROMPT_CONFIG.meta.model;
const MAX_TOKENS: number = PROMPT_CONFIG.meta.max_tokens;
const TEMPERATURE: number = PROMPT_CONFIG.meta.temperature;

const SYSTEM_TEXT =
  PROMPT_CONFIG.system_prompt +
  "\n\n## OUTPUT SCHEMA\n\nYou MUST respond with valid JSON matching this exact schema:\n\n```json\n" +
  JSON.stringify(SCHEMA_CONFIG.verdict_schema, null, 2) +
  "\n```";

const TOOLS: Anthropic.Tool[] = PROMPT_CONFIG.tools.map(
  (t: { name: string; description: string; input_schema: Record<string, unknown> }) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  })
);

const client = new Anthropic();

// --- Local tool handlers (minimal stubs mirrored from src/app/api/verdict/route.ts) ---

interface MarketResearchInput {
  keywords: string[];
  intent: "validate_demand" | "find_competitors" | "check_sentiment" | "find_pricing";
}

interface MarketResearchResult {
  query: string;
  results: Array<{ title: string; url: string; snippet: string; date: string | null; relevance: number }>;
  source: "exa_search" | "fake_fallback";
  result_count: number;
}

async function executeMarketResearch(input: MarketResearchInput): Promise<MarketResearchResult> {
  const intentPrefix: Record<string, string> = {
    validate_demand: "user demand pain points for",
    find_competitors: "competitors alternatives to",
    check_sentiment: "user reviews opinions about",
    find_pricing: "pricing plans cost of",
  };
  const query = `${intentPrefix[input.intent] ?? ""} ${input.keywords.join(" ")}`.trim();

  if (!process.env.EXA_API_KEY) {
    // Deterministic fake fallback — enough to trigger "competition validates demand" framing
    const snippet = `Placeholder competitor snippet for query: ${query}. Users discuss pricing, pain points, and alternatives.`;
    return {
      query,
      results: [
        {
          title: "Placeholder competitor A",
          url: "https://example.com/fake-a",
          snippet,
          date: null,
          relevance: 0.8,
        },
        {
          title: "Placeholder competitor B",
          url: "https://example.com/fake-b",
          snippet,
          date: null,
          relevance: 0.7,
        },
        {
          title: "Placeholder forum thread",
          url: "https://example.com/fake-forum",
          snippet,
          date: null,
          relevance: 0.6,
        },
      ],
      source: "fake_fallback",
      result_count: 3,
    };
  }

  // Real Exa path
  try {
    const { default: Exa } = await import("exa-js");
    const exa = new Exa(process.env.EXA_API_KEY);
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
    console.log(`    [exa error] ${err instanceof Error ? err.message : String(err)}`);
    return { query, results: [], source: "exa_search", result_count: 0 };
  }
}

function executeLegalCheck(input: { domain: string; regions?: string[] }) {
  const regions = input.regions ?? ["US"];
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
  };
}

function executeFinanceCalc(input: { business_model: string; features: string[]; target_price?: number }) {
  const featureCount = input.features.length;
  const baseMonthly = input.business_model === "saas" ? 500
    : input.business_model === "marketplace" ? 800
    : input.business_model === "ecommerce" ? 600
    : input.business_model === "hardware" ? 1500
    : 400;
  const estimatedCost = baseMonthly + (featureCount * 200);
  const suggestedPrice = input.target_price ?? (input.business_model === "saas" ? 15 : 29);
  const breakeven = Math.ceil(estimatedCost / suggestedPrice);
  return {
    business_model: input.business_model,
    estimated_mvp_cost_monthly_usd: estimatedCost,
    breakeven_users: breakeven,
    suggested_price_usd: suggestedPrice,
    unit_economics_summary: `${featureCount} features, $${estimatedCost}/mo infra, need ${breakeven} users at $${suggestedPrice}/mo to break even`,
    source: "llm_estimate",
  };
}

function executeTechFeasibility(input: { requirements: string[] }) {
  const reqs = input.requirements;
  const hasRealtime = reqs.some(r => /real-?time|websocket|live/i.test(r));
  const hasAI = reqs.some(r => /ai|ml|machine.?learn|llm|gpt|model/i.test(r));
  const hasPayments = reqs.some(r => /payment|stripe|billing|subscription/i.test(r));
  const hasVideo = reqs.some(r => /video|stream|media/i.test(r));
  const complexFactors = [hasRealtime, hasAI, hasPayments, hasVideo].filter(Boolean).length;
  const complexity =
    reqs.length <= 2 && complexFactors === 0 ? "simple"
    : reqs.length <= 4 && complexFactors <= 1 ? "moderate"
    : reqs.length <= 6 && complexFactors <= 2 ? "complex"
    : "very_complex";
  const weeksMap: Record<string, number> = { simple: 4, moderate: 8, complex: 14, very_complex: 24 };
  return {
    stack_suggestion: "Next.js + React + Supabase + Vercel" + (hasAI ? " + Claude API" : "") + (hasPayments ? " + Stripe" : ""),
    complexity,
    estimated_mvp_weeks: weeksMap[complexity],
    key_challenges: complexFactors > 0 ? ["mixed stack challenges"] : ["Standard web application"],
    source: "llm_analysis",
  };
}

// --- Robust JSON extractor: strips fences, narrative preambles, trailing text ---

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  // Find the first balanced top-level JSON object
  const start = fenced.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < fenced.length; i++) {
    const ch = fenced[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return fenced.slice(start, i + 1);
    }
  }
  return null;
}

// --- Tool-use loop (max 4 iterations per spec) ---

const MAX_TURNS = 4;

async function callOnceWithTools(userMessage: string, retry = true): Promise<{
  verdict: Verdict | null;
  toolCalls: Array<{ name: string; turn: number }>;
}> {
  const toolCalls: Array<{ name: string; turn: number }> = [];
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: `Evaluate this idea and respond with valid JSON only:\n\n${userMessage}` },
  ];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: [{
          type: "text" as const,
          text: SYSTEM_TEXT,
          cache_control: { type: "ephemeral" as const },
        }],
        messages,
        tools: TOOLS,
      });

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUseBlocks.length > 0 && response.stop_reason === "tool_use") {
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const tb of toolUseBlocks) {
          toolCalls.push({ name: tb.name, turn });
          let resultContent: string;
          if (tb.name === "market_research") {
            const r = await executeMarketResearch(tb.input as MarketResearchInput);
            resultContent = JSON.stringify(r);
          } else if (tb.name === "legal_check") {
            resultContent = JSON.stringify(executeLegalCheck(tb.input as { domain: string; regions?: string[] }));
          } else if (tb.name === "finance_calc") {
            resultContent = JSON.stringify(executeFinanceCalc(tb.input as { business_model: string; features: string[]; target_price?: number }));
          } else if (tb.name === "tech_feasibility") {
            resultContent = JSON.stringify(executeTechFeasibility(tb.input as { requirements: string[] }));
          } else {
            toolResults.push({
              type: "tool_result",
              tool_use_id: tb.id,
              content: JSON.stringify({ error: `Tool ${tb.name} not implemented` }),
              is_error: true,
            });
            continue;
          }
          toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: resultContent });
        }
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Final response — parse verdict JSON from text (robust: handles fences + narrative preambles)
      const textBlocks = response.content.filter((b) => b.type === "text");
      const rawText = textBlocks.map((b) => (b as { text: string }).text).join("\n");
      const cleaned = extractJson(rawText);
      if (!cleaned) {
        console.log(`    [parse] no JSON object found in response (first 120 chars: ${rawText.slice(0, 120)})`);
        return { verdict: null, toolCalls };
      }
      try {
        const parsed = VerdictSchema.safeParse(JSON.parse(cleaned));
        return { verdict: parsed.success ? parsed.data : null, toolCalls };
      } catch (e) {
        console.log(`    [parse] JSON.parse failed (first 120 chars: ${cleaned.slice(0, 120)})`);
        return { verdict: null, toolCalls };
      }
    }
    // Max turns exceeded without final verdict
    console.log(`    [max turns exceeded]`);
    return { verdict: null, toolCalls };
  } catch (err) {
    if (retry && err instanceof Anthropic.APIError && (err.status === 429 || err.status >= 500)) {
      console.log(`    [retry] ${err.status} — waiting 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      return callOnceWithTools(userMessage, false);
    }
    console.log(`    [error] ${err instanceof Error ? err.message : String(err)}`);
    return { verdict: null, toolCalls };
  }
}

// --- Runner ---

interface Run {
  probeId: string;
  bucket: Bucket;
  expected: string;
  runIndex: number;
  verdict: string | null;
  confidence: number | null;
  evidenceTypes: string[];
  toolCalls: Array<{ name: string; turn: number }>;
}

function parseArgs() {
  let runs = 3;
  let filter: Bucket | null = null;
  let tag: string | null = null;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--runs") runs = parseInt(process.argv[++i], 10);
    else if (process.argv[i] === "--filter") {
      const f = process.argv[++i];
      if (f === "bad" || f === "good" || f === "pivot") filter = f;
    }
    else if (process.argv[i] === "--tag") tag = process.argv[++i];
  }
  return { runs, filter, tag };
}

async function main() {
  const { runs, filter, tag } = parseArgs();
  const probes = filter ? PROBES.filter((p) => p.bucket === filter) : PROBES;

  console.log(`Council v2 Bias Test — WITH TOOLS (Exa-enabled path)`);
  console.log(`Model: ${MODEL} | Temp: ${TEMPERATURE} | Probes: ${probes.length} × ${runs} = ${probes.length * runs} calls`);
  console.log(`Prompt version: ${PROMPT_CONFIG.meta.version} | Exa: ${process.env.EXA_API_KEY ? "REAL" : "FAKE fallback"}`);
  console.log("=".repeat(70));

  const all: Run[] = [];

  for (const probe of probes) {
    console.log(`\n[${probe.id}] ${probe.bucket.toUpperCase()} / expected ${probe.expected}`);
    console.log(`      "${probe.input.slice(0, 80)}${probe.input.length > 80 ? "..." : ""}"`);
    console.log(`      note: ${probe.note}`);

    for (let r = 0; r < runs; r++) {
      const { verdict, toolCalls } = await callOnceWithTools(probe.input);
      const row: Run = {
        probeId: probe.id,
        bucket: probe.bucket,
        expected: probe.expected,
        runIndex: r + 1,
        verdict: verdict?.verdict ?? null,
        confidence: verdict?.confidence.score ?? null,
        evidenceTypes: verdict?.reasons.map((x) => x.evidence.type) ?? [],
        toolCalls,
      };
      all.push(row);
      const hit = row.verdict === probe.expected ? "✓" : "✗";
      const toolSummary = toolCalls.length > 0 ? `tools=[${toolCalls.map(t => t.name).join(",")}]` : "no-tools";
      console.log(`      run ${r + 1}: ${row.verdict ?? "ERROR"} @ ${row.confidence ?? "?"}%  ${hit}  [${row.evidenceTypes.join(", ")}] ${toolSummary}`);
    }
  }

  // --- Summary ---

  console.log("\n" + "=".repeat(70));
  console.log("BIAS TEST SUMMARY (with tools)");
  console.log("=".repeat(70));

  for (const bucket of ["bad", "good", "pivot"] as Bucket[]) {
    const rows = all.filter((r) => r.bucket === bucket);
    if (rows.length === 0) continue;
    const hits = rows.filter((r) => r.verdict === r.expected).length;
    console.log(`${bucket.padEnd(6)} verdict match: ${hits}/${rows.length} (${((hits / rows.length) * 100).toFixed(0)}%)`);
  }

  console.log("\nConfidence histogram (all runs):");
  const buckets: Record<string, number> = {};
  for (const r of all) {
    if (r.confidence == null) continue;
    const key = `${Math.floor(r.confidence / 5) * 5}-${Math.floor(r.confidence / 5) * 5 + 4}`;
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  const keys = Object.keys(buckets).sort((a, b) => parseInt(a) - parseInt(b));
  const maxCount = Math.max(...Object.values(buckets), 1);
  for (const k of keys) {
    const bar = "█".repeat(Math.round((buckets[k] / maxCount) * 30));
    console.log(`  ${k.padEnd(7)} ${String(buckets[k]).padStart(3)}  ${bar}`);
  }

  console.log("\nPer-probe confidence variance:");
  const probeConfs: Record<string, number[]> = {};
  for (const r of all) {
    if (r.confidence == null) continue;
    (probeConfs[r.probeId] ??= []).push(r.confidence);
  }
  for (const pid of Object.keys(probeConfs).sort()) {
    const vals = probeConfs[pid];
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance);
    console.log(`  ${pid}  mean=${mean.toFixed(1)}  std=${std.toFixed(1)}  values=[${vals.join(", ")}]`);
  }

  const at72 = all.filter((r) => r.confidence === 72).length;
  const nearAnchor = all.filter((r) => r.confidence != null && r.confidence >= 70 && r.confidence <= 74).length;
  console.log(`\n72% anchor check:`);
  console.log(`  Exactly 72%:      ${at72}/${all.length} (${((at72 / all.length) * 100).toFixed(0)}%)  [target ≤15%]`);
  console.log(`  Within 70-74%:    ${nearAnchor}/${all.length} (${((nearAnchor / all.length) * 100).toFixed(0)}%)  [target ≤30%]`);

  console.log("\nEvidence tag distribution (all reasons):");
  const tagCounts: Record<string, number> = {};
  for (const r of all) for (const t of r.evidenceTypes) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const totalTags = Object.values(tagCounts).reduce((a, b) => a + b, 0);
  for (const [t, c] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(15)} ${String(c).padStart(3)}  (${((c / Math.max(totalTags, 1)) * 100).toFixed(0)}%)`);
  }
  const trainPct = ((tagCounts["training_data"] ?? 0) / Math.max(totalTags, 1)) * 100;
  console.log(`  training_data rate: ${trainPct.toFixed(0)}% — target ≤20%`);

  // Tool-call stats
  const totalToolCalls = all.reduce((acc, r) => acc + r.toolCalls.length, 0);
  const runsWithAnyTool = all.filter((r) => r.toolCalls.length > 0).length;
  console.log(`\nTool-use stats:`);
  console.log(`  Runs with ≥1 tool call: ${runsWithAnyTool}/${all.length}`);
  console.log(`  Total tool invocations: ${totalToolCalls}`);

  // Save
  const resultsDir = join(__dirname, "results");
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tagPart = tag ? `-${tag}` : "";
  const filePath = join(resultsDir, `bias-test-exa${tagPart}-${timestamp}.json`);
  writeFileSync(filePath, JSON.stringify({
    meta: {
      timestamp: new Date().toISOString(),
      model: MODEL,
      prompt_version: PROMPT_CONFIG.meta.version,
      probes: probes.length,
      runs_per_probe: runs,
      exa_mode: process.env.EXA_API_KEY ? "real" : "fake_fallback",
      tag,
    },
    probes,
    runs: all,
  }, null, 2));
  console.log(`\nResults saved to: ${filePath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
