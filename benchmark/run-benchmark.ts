/**
 * Council Benchmark Runner — Week 1
 *
 * Runs all 10 gold test prompts through:
 * 1. Council (strategist system prompt with structured output)
 * 2. Single-prompt baseline (same schema, simpler prompt)
 *
 * Saves results to benchmark/results/ for blind comparison.
 *
 * Usage:
 *   npx tsx benchmark/run-benchmark.ts
 *   npx tsx benchmark/run-benchmark.ts --baseline-only
 *   npx tsx benchmark/run-benchmark.ts --council-only
 *   npx tsx benchmark/run-benchmark.ts --prompt g01
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, basename } from "path";

// Load .env.local
const envPath = join(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { BASELINE_SYSTEM_PROMPT } from "./baseline-prompt";
import { STRATEGIST_SYSTEM_PROMPT } from "../src/lib/agents/strategist";

// --- Config ---
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8000;
const TEMPERATURE = 0.7;

const GOLD_DIR = join(__dirname, "../../prompts/gold-test-set");
const RESULTS_DIR = join(__dirname, "results");

// --- Init ---
const client = new Anthropic();

interface RunResult {
  promptId: string;
  mode: "council" | "baseline";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  brief: Record<string, unknown> | null;
  rawText: string;
  error: string | null;
  timestamp: string;
}

// --- Pricing ---
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

// --- Load gold prompts ---
function loadGoldPrompts(filter?: string): { id: string; content: string }[] {
  const files = readdirSync(GOLD_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files
    .filter((f) => !filter || f.includes(filter))
    .map((f) => ({
      id: f.replace(".md", ""),
      content: readFileSync(join(GOLD_DIR, f), "utf-8").trim(),
    }));
}

// --- Run single prompt ---
async function runSingle(
  promptId: string,
  userPrompt: string,
  systemPrompt: string,
  mode: "council" | "baseline"
): Promise<RunResult> {
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const durationMs = Date.now() - start;
    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cacheRead = (response.usage as Record<string, number>).cache_read_input_tokens ?? 0;
    const cacheWrite = (response.usage as Record<string, number>).cache_creation_input_tokens ?? 0;

    let brief: Record<string, unknown> | null = null;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      brief = JSON.parse(cleaned);
    } catch {
      // JSON parse failed
    }

    const costUsd = calcCost(inputTokens, outputTokens, cacheRead, cacheWrite);

    return {
      promptId,
      mode,
      model: MODEL,
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheRead,
      cacheWriteTokens: cacheWrite,
      costUsd,
      durationMs,
      brief,
      rawText,
      error: null,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      promptId,
      mode,
      model: MODEL,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - start,
      brief: null,
      rawText: "",
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    };
  }
}

// --- Save result ---
function saveResult(result: RunResult) {
  const dir = join(RESULTS_DIR, result.mode);
  mkdirSync(dir, { recursive: true });

  const filePath = join(dir, `${result.promptId}.json`);
  writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

// --- Summary ---
function printSummary(results: RunResult[]) {
  console.log("\n" + "=".repeat(70));
  console.log("BENCHMARK SUMMARY");
  console.log("=".repeat(70));

  const council = results.filter((r) => r.mode === "council");
  const baseline = results.filter((r) => r.mode === "baseline");

  for (const group of [
    { name: "Council", results: council },
    { name: "Baseline", results: baseline },
  ]) {
    if (group.results.length === 0) continue;

    const successful = group.results.filter((r) => !r.error);
    const totalCost = successful.reduce((s, r) => s + r.costUsd, 0);
    const avgDuration =
      successful.reduce((s, r) => s + r.durationMs, 0) / (successful.length || 1);
    const avgOutput =
      successful.reduce((s, r) => s + r.outputTokens, 0) / (successful.length || 1);

    console.log(`\n${group.name}:`);
    console.log(`  Runs: ${successful.length}/${group.results.length} successful`);
    console.log(`  Total cost: $${totalCost.toFixed(4)}`);
    console.log(`  Avg duration: ${(avgDuration / 1000).toFixed(1)}s`);
    console.log(`  Avg output tokens: ${Math.round(avgOutput)}`);

    for (const r of group.results) {
      const status = r.error ? "FAIL" : r.brief ? "OK" : "NO_JSON";
      const score = r.brief
        ? (r.brief as { executiveSummary?: { councilScore?: number } })
            .executiveSummary?.councilScore ?? "?"
        : "-";
      console.log(
        `  ${r.promptId}: ${status} | score=${score} | $${r.costUsd.toFixed(4)} | ${(r.durationMs / 1000).toFixed(1)}s`
      );
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Results saved to: ${RESULTS_DIR}/`);
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const baselineOnly = args.includes("--baseline-only");
  const councilOnly = args.includes("--council-only");
  const promptFilter = args.find((a) => !a.startsWith("--"));

  const prompts = loadGoldPrompts(promptFilter);
  console.log(`Loaded ${prompts.length} gold test prompt(s)`);

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const results: RunResult[] = [];

  for (const prompt of prompts) {
    // --- Council ---
    if (!baselineOnly) {
      console.log(`\n[council] Running ${prompt.id}...`);
      const result = await runSingle(
        prompt.id,
        prompt.content,
        STRATEGIST_SYSTEM_PROMPT,
        "council"
      );
      const path = saveResult(result);
      results.push(result);
      console.log(
        `[council] ${prompt.id}: ${result.error ? "FAIL" : "OK"} | ` +
          `$${result.costUsd.toFixed(4)} | ${(result.durationMs / 1000).toFixed(1)}s → ${path}`
      );
    }

    // --- Baseline ---
    if (!councilOnly) {
      console.log(`[baseline] Running ${prompt.id}...`);
      const result = await runSingle(
        prompt.id,
        prompt.content,
        BASELINE_SYSTEM_PROMPT,
        "baseline"
      );
      const path = saveResult(result);
      results.push(result);
      console.log(
        `[baseline] ${prompt.id}: ${result.error ? "FAIL" : "OK"} | ` +
          `$${result.costUsd.toFixed(4)} | ${(result.durationMs / 1000).toFixed(1)}s → ${path}`
      );
    }
  }

  printSummary(results);
}

main().catch(console.error);
