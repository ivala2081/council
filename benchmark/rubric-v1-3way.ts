/**
 * 3-Way Rubric Evaluation — Week 2
 *
 * Compares Council (single) vs Dual-step vs Baseline
 * Uses pairwise comparisons: dual vs council, dual vs baseline
 *
 * Usage:
 *   npx tsx benchmark/rubric-v1-3way.ts
 *   npx tsx benchmark/rubric-v1-3way.ts g01
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const envPath = join(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

import Anthropic from "@anthropic-ai/sdk";

const RESULTS_DIR = join(__dirname, "results");
const EVAL_DIR = join(RESULTS_DIR, "evaluations-week2");
const JUDGE_MODEL = "claude-sonnet-4-20250514";

const client = new Anthropic();

interface RubricScore {
  specificity: number;
  actionability: number;
  depth: number;
  realism: number;
  decisionClarity: number;
}

const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for startup strategy briefs. You will receive three strategic briefs (Output A, Output B, Output C) generated for the same founder prompt. You do NOT know which system produced which output.

Score each output on these 5 dimensions (1-5 scale):

1. **Specificity** (1-5): Real companies, concrete numbers, specific markets vs generic advice
2. **Actionability** (1-5): Could the founder take action THIS WEEK?
3. **Depth** (1-5): Beyond surface-level? Non-obvious insights?
4. **Realism** (1-5): Grounded claims? Properly labeled estimates?
5. **Decision Clarity** (1-5): Clear decisions, options, tradeoffs, recommendations?

Respond with valid JSON only:
{
  "outputA": {
    "scores": { "specificity": N, "actionability": N, "depth": N, "realism": N, "decisionClarity": N },
    "strengths": ["..."],
    "weaknesses": ["..."]
  },
  "outputB": {
    "scores": { "specificity": N, "actionability": N, "depth": N, "realism": N, "decisionClarity": N },
    "strengths": ["..."],
    "weaknesses": ["..."]
  },
  "outputC": {
    "scores": { "specificity": N, "actionability": N, "depth": N, "realism": N, "decisionClarity": N },
    "strengths": ["..."],
    "weaknesses": ["..."]
  },
  "ranking": ["A", "B", "C"],
  "rankingReason": "Which output would you trust most for a real decision, and why?",
  "keyDifferences": ["..."]
}

No markdown fences. Pure JSON only.`;

function loadTriple(promptId: string): { council: string; dual: string; baseline: string } | null {
  const councilPath = join(RESULTS_DIR, "council", `${promptId}.json`);
  const dualPath = join(RESULTS_DIR, "dual", `${promptId}.json`);
  const baselinePath = join(RESULTS_DIR, "baseline", `${promptId}.json`);

  if (!existsSync(councilPath) || !existsSync(dualPath) || !existsSync(baselinePath)) return null;

  const council = JSON.parse(readFileSync(councilPath, "utf-8"));
  const dual = JSON.parse(readFileSync(dualPath, "utf-8"));
  const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));

  if (!council.brief || !dual.brief || !baseline.brief) return null;

  return {
    council: JSON.stringify(council.brief, null, 2),
    dual: JSON.stringify(dual.brief, null, 2),
    baseline: JSON.stringify(baseline.brief, null, 2),
  };
}

async function evaluateTriple(promptId: string, briefs: { council: string; dual: string; baseline: string }) {
  // Randomize assignment
  const modes = ["council", "dual", "baseline"] as const;
  const shuffled = [...modes].sort(() => Math.random() - 0.5);
  const labels = ["A", "B", "C"] as const;

  const mapping: Record<string, string> = {};
  const reverseMapping: Record<string, string> = {};
  for (let i = 0; i < 3; i++) {
    mapping[labels[i]] = shuffled[i];
    reverseMapping[shuffled[i]] = labels[i];
  }

  const userPrompt = `## Founder Prompt ID: ${promptId}

## Output A
${briefs[shuffled[0] as keyof typeof briefs]}

## Output B
${briefs[shuffled[1] as keyof typeof briefs]}

## Output C
${briefs[shuffled[2] as keyof typeof briefs]}

Evaluate all three outputs. You don't know which system produced which.`;

  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 3000,
    temperature: 0,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);

  // Map back to real labels
  const result: Record<string, unknown> = {
    promptId,
    mapping,
    timestamp: new Date().toISOString(),
  };

  for (const mode of modes) {
    const label = reverseMapping[mode];
    const outputKey = `output${label}` as string;
    result[mode] = {
      scores: parsed[outputKey].scores,
      strengths: parsed[outputKey].strengths,
      weaknesses: parsed[outputKey].weaknesses,
      total: Object.values(parsed[outputKey].scores as Record<string, number>).reduce((a: number, b: number) => a + b, 0),
    };
  }

  // Map ranking back to real modes
  const ranking = (parsed.ranking as string[]).map((label: string) => mapping[label]);
  result.ranking = ranking;
  result.rankingReason = parsed.rankingReason;
  result.keyDifferences = parsed.keyDifferences;
  result.winner = ranking[0];

  return result;
}

async function main() {
  const filter = process.argv[2];

  const promptIds = readdirSync(join(RESULTS_DIR, "dual"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .filter((id) => !filter || id.includes(filter))
    .sort();

  if (promptIds.length === 0) {
    console.error("No dual results found. Run dual benchmark first.");
    process.exit(1);
  }

  mkdirSync(EVAL_DIR, { recursive: true });
  const evals: Record<string, unknown>[] = [];

  for (const promptId of promptIds) {
    const triple = loadTriple(promptId);
    if (!triple) {
      console.log(`[skip] ${promptId} — missing results`);
      continue;
    }

    console.log(`[eval] ${promptId}...`);
    const result = await evaluateTriple(promptId, triple);
    evals.push(result);
    writeFileSync(join(EVAL_DIR, `${promptId}.json`), JSON.stringify(result, null, 2));
  }

  writeFileSync(join(EVAL_DIR, "_summary.json"), JSON.stringify(evals, null, 2));

  // --- Summary ---
  console.log("\n" + "=".repeat(70));
  console.log("3-WAY EVALUATION SUMMARY — Week 2");
  console.log("=".repeat(70));

  const wins: Record<string, number> = { council: 0, dual: 0, baseline: 0 };
  const allScores: Record<string, RubricScore[]> = { council: [], dual: [], baseline: [] };

  for (const ev of evals) {
    const winner = ev.winner as string;
    wins[winner]++;

    for (const mode of ["council", "dual", "baseline"]) {
      const modeData = ev[mode] as { scores: RubricScore; total: number };
      allScores[mode].push(modeData.scores);

      console.log(`\n${ev.promptId}: ${mode}=${modeData.total}/25`);
    }
    console.log(`  Winner: ${winner}`);
    console.log(`  Reason: ${ev.rankingReason}`);
  }

  const avg = (scores: RubricScore[], key: keyof RubricScore) =>
    (scores.reduce((s, r) => s + r[key], 0) / (scores.length || 1)).toFixed(2);

  console.log("\n" + "-".repeat(70));
  console.log("DIMENSION AVERAGES:");
  console.log(`${"Dimension".padEnd(20)} ${"Council".padEnd(10)} ${"Dual".padEnd(10)} ${"Baseline".padEnd(10)}`);
  for (const dim of ["specificity", "actionability", "depth", "realism", "decisionClarity"] as const) {
    console.log(
      `${dim.padEnd(20)} ${avg(allScores.council, dim).padEnd(10)} ${avg(allScores.dual, dim).padEnd(10)} ${avg(allScores.baseline, dim)}`
    );
  }

  console.log(`\nWin rate: Council ${wins.council} | Dual ${wins.dual} | Baseline ${wins.baseline}`);
  console.log("=".repeat(70));
}

main().catch(console.error);
