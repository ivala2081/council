/**
 * Dual-Step Benchmark Runner — Week 2
 *
 * Runs all 10 gold test prompts through the dual-step pipeline:
 * Step 1: Triage (Haiku) → Step 2: Strategist (Sonnet)
 *
 * Saves results to benchmark/results/dual/ for comparison.
 *
 * Usage:
 *   npx tsx benchmark/run-dual-benchmark.ts
 *   npx tsx benchmark/run-dual-benchmark.ts g01
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
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
import { runDualPipeline, type DualStepResult } from "../src/lib/pipeline/dual";

const GOLD_DIR = join(__dirname, "../../prompts/gold-test-set");
const RESULTS_DIR = join(__dirname, "results");
const DUAL_DIR = join(RESULTS_DIR, "dual");

const client = new Anthropic();

interface DualRunResult {
  promptId: string;
  mode: "dual";
  triage: DualStepResult["triage"];
  strategist: DualStepResult["strategist"];
  totalCostUsd: number;
  totalDurationMs: number;
  brief: Record<string, unknown> | null;
  error: string | null;
  timestamp: string;
}

function loadGoldPrompts(filter?: string): { id: string; content: string }[] {
  const files = readdirSync(GOLD_DIR).filter((f) => f.endsWith(".md")).sort();
  return files
    .filter((f) => !filter || f.includes(filter))
    .map((f) => ({
      id: f.replace(".md", ""),
      content: readFileSync(join(GOLD_DIR, f), "utf-8").trim(),
    }));
}

function saveResult(result: DualRunResult) {
  mkdirSync(DUAL_DIR, { recursive: true });
  const filePath = join(DUAL_DIR, `${result.promptId}.json`);
  writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

async function main() {
  const filter = process.argv[2];
  const prompts = loadGoldPrompts(filter);
  console.log(`Loaded ${prompts.length} gold test prompt(s)`);

  const results: DualRunResult[] = [];

  for (const prompt of prompts) {
    console.log(`\n[dual] Running ${prompt.id}...`);

    try {
      const pipelineResult = await runDualPipeline(client, prompt.content);

      const result: DualRunResult = {
        promptId: prompt.id,
        mode: "dual",
        triage: pipelineResult.triage,
        strategist: pipelineResult.strategist,
        totalCostUsd: pipelineResult.totalCostUsd,
        totalDurationMs: pipelineResult.totalDurationMs,
        brief: pipelineResult.strategist.brief,
        error: null,
        timestamp: new Date().toISOString(),
      };

      const path = saveResult(result);
      results.push(result);

      const triageOk = pipelineResult.triage.output ? "OK" : "FAIL";
      const briefOk = pipelineResult.strategist.brief ? "OK" : "NO_JSON";

      console.log(
        `[dual] ${prompt.id}: triage=${triageOk} brief=${briefOk} | ` +
          `triage=$${pipelineResult.triage.costUsd.toFixed(4)}/${(pipelineResult.triage.durationMs / 1000).toFixed(1)}s | ` +
          `strat=$${pipelineResult.strategist.costUsd.toFixed(4)}/${(pipelineResult.strategist.durationMs / 1000).toFixed(1)}s | ` +
          `total=$${pipelineResult.totalCostUsd.toFixed(4)}/${(pipelineResult.totalDurationMs / 1000).toFixed(1)}s → ${path}`
      );
    } catch (err) {
      const result: DualRunResult = {
        promptId: prompt.id,
        mode: "dual",
        triage: { output: null, rawText: "", model: "", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, durationMs: 0 },
        strategist: { brief: null, rawText: "", model: "", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, durationMs: 0 },
        totalCostUsd: 0,
        totalDurationMs: 0,
        brief: null,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      };
      saveResult(result);
      results.push(result);
      console.log(`[dual] ${prompt.id}: ERROR — ${result.error}`);
    }
  }

  // --- Summary ---
  console.log("\n" + "=".repeat(70));
  console.log("DUAL-STEP BENCHMARK SUMMARY");
  console.log("=".repeat(70));

  const successful = results.filter((r) => !r.error && r.brief);
  const totalCost = successful.reduce((s, r) => s + r.totalCostUsd, 0);
  const avgDuration = successful.reduce((s, r) => s + r.totalDurationMs, 0) / (successful.length || 1);
  const avgTriageCost = successful.reduce((s, r) => s + r.triage.costUsd, 0) / (successful.length || 1);
  const avgTriageDuration = successful.reduce((s, r) => s + r.triage.durationMs, 0) / (successful.length || 1);
  const avgStratCost = successful.reduce((s, r) => s + r.strategist.costUsd, 0) / (successful.length || 1);

  console.log(`\nRuns: ${successful.length}/${results.length} successful`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Avg total duration: ${(avgDuration / 1000).toFixed(1)}s`);
  console.log(`Avg triage cost: $${avgTriageCost.toFixed(4)} (${(avgTriageDuration / 1000).toFixed(1)}s)`);
  console.log(`Avg strategist cost: $${avgStratCost.toFixed(4)}`);

  for (const r of results) {
    const status = r.error ? "FAIL" : r.brief ? "OK" : "NO_JSON";
    const score = r.brief
      ? (r.brief as { executiveSummary?: { councilScore?: number } }).executiveSummary?.councilScore ?? "?"
      : "-";
    console.log(
      `  ${r.promptId}: ${status} | score=${score} | $${r.totalCostUsd.toFixed(4)} | ${(r.totalDurationMs / 1000).toFixed(1)}s`
    );
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
