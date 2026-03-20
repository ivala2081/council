/**
 * Council Benchmark Rubric v1
 *
 * AI-assisted evaluation: runs each pair of outputs (Council vs Baseline)
 * through an LLM judge using a structured rubric.
 *
 * Rubric dimensions (from COUNCIL_EVAL_SYSTEM.md):
 * - specificity (1-5)
 * - actionability (1-5)
 * - depth (1-5)
 * - realism/accuracy (1-5)
 * - decision clarity (1-5)
 *
 * Usage:
 *   npx tsx benchmark/rubric-v1.ts
 *   npx tsx benchmark/rubric-v1.ts g01
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
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

const RESULTS_DIR = join(__dirname, "results");
const EVAL_DIR = join(RESULTS_DIR, "evaluations");
const JUDGE_MODEL = "claude-sonnet-4-20250514";

const client = new Anthropic();

interface RubricScore {
  specificity: number;
  actionability: number;
  depth: number;
  realism: number;
  decisionClarity: number;
}

interface EvalResult {
  promptId: string;
  outputA: { mode: string; scores: RubricScore; strengths: string[]; weaknesses: string[] };
  outputB: { mode: string; scores: RubricScore; strengths: string[]; weaknesses: string[] };
  preference: "A" | "B" | "tie";
  preferenceReason: string;
  keyDifferences: string[];
  timestamp: string;
}

const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for startup strategy briefs. You will receive two strategic briefs (Output A and Output B) generated for the same founder prompt. You do NOT know which system produced which output.

## Your Task

Score each output on these 5 dimensions (1-5 scale):

1. **Specificity** (1-5): Does it name real companies, give concrete numbers, reference specific markets? Or is it generic advice that could apply to any startup?
   - 1: Completely generic, no specifics
   - 3: Mix of specific and generic
   - 5: Highly specific with named competitors, real data points, precise recommendations

2. **Actionability** (1-5): Could the founder take action THIS WEEK based on this advice? Are the next steps clear and concrete?
   - 1: Vague platitudes ("do market research")
   - 3: Some actionable items but missing specifics
   - 5: Every recommendation has a clear what, when, and how

3. **Depth** (1-5): Does it go beyond surface-level analysis? Does it reveal non-obvious insights?
   - 1: Surface-level only, states the obvious
   - 3: Adequate depth on some topics
   - 5: Deep analysis with non-obvious insights, second-order effects

4. **Realism / Accuracy** (1-5): Are the claims, numbers, and recommendations grounded in reality? Does it properly label estimates vs facts?
   - 1: Contains clearly wrong claims or unrealistic advice
   - 3: Mostly reasonable but some questionable assertions
   - 5: Well-grounded, honest about uncertainty, realistic advice

5. **Decision Clarity** (1-5): Does the Decision Agenda section clearly frame the key decisions, options, tradeoffs, and recommendations?
   - 1: No clear decisions surfaced
   - 3: Decisions mentioned but tradeoffs unclear
   - 5: Crystal clear decisions with well-reasoned options and recommendations

## Output Format

Respond with a valid JSON object:
{
  "outputA": {
    "scores": { "specificity": N, "actionability": N, "depth": N, "realism": N, "decisionClarity": N },
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"]
  },
  "outputB": {
    "scores": { "specificity": N, "actionability": N, "depth": N, "realism": N, "decisionClarity": N },
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"]
  },
  "preference": "A" | "B" | "tie",
  "preferenceReason": "Which output would you trust more for a real decision, and why?",
  "keyDifferences": ["difference 1", "difference 2"]
}

No markdown fences. Pure JSON only.`;

function loadResultPairs(filter?: string): { promptId: string; council: string; baseline: string }[] {
  const councilDir = join(RESULTS_DIR, "council");
  const baselineDir = join(RESULTS_DIR, "baseline");

  if (!existsSync(councilDir) || !existsSync(baselineDir)) {
    console.error("Results not found. Run benchmark first: npx tsx benchmark/run-benchmark.ts");
    process.exit(1);
  }

  const councilFiles = readdirSync(councilDir).filter((f) => f.endsWith(".json"));
  const pairs: { promptId: string; council: string; baseline: string }[] = [];

  for (const file of councilFiles) {
    const promptId = file.replace(".json", "");
    if (filter && !promptId.includes(filter)) continue;

    const baselinePath = join(baselineDir, file);
    if (!existsSync(baselinePath)) continue;

    const councilResult = JSON.parse(readFileSync(join(councilDir, file), "utf-8"));
    const baselineResult = JSON.parse(readFileSync(baselinePath, "utf-8"));

    if (!councilResult.brief || !baselineResult.brief) continue;

    pairs.push({
      promptId,
      council: JSON.stringify(councilResult.brief, null, 2),
      baseline: JSON.stringify(baselineResult.brief, null, 2),
    });
  }

  return pairs;
}

async function evaluatePair(
  promptId: string,
  councilBrief: string,
  baselineBrief: string
): Promise<EvalResult> {
  // Randomize A/B assignment for blind evaluation
  const councilIsA = Math.random() > 0.5;
  const outputA = councilIsA ? councilBrief : baselineBrief;
  const outputB = councilIsA ? baselineBrief : councilBrief;
  const modeA = councilIsA ? "council" : "baseline";
  const modeB = councilIsA ? "baseline" : "council";

  const userPrompt = `## Founder Prompt ID: ${promptId}

## Output A
${outputA}

## Output B
${outputB}

Evaluate both outputs using the rubric. Remember: you don't know which system produced which.`;

  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 2000,
    temperature: 0,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    promptId,
    outputA: { mode: modeA, ...parsed.outputA },
    outputB: { mode: modeB, ...parsed.outputB },
    preference:
      parsed.preference === "A" ? (councilIsA ? "A" : "B") :
      parsed.preference === "B" ? (councilIsA ? "B" : "A") : "tie",
    preferenceReason: parsed.preferenceReason,
    keyDifferences: parsed.keyDifferences,
    timestamp: new Date().toISOString(),
  };
}

function printEvalSummary(evals: EvalResult[]) {
  console.log("\n" + "=".repeat(70));
  console.log("EVALUATION SUMMARY — Rubric v1");
  console.log("=".repeat(70));

  let councilWins = 0;
  let baselineWins = 0;
  let ties = 0;
  const councilScores: RubricScore[] = [];
  const baselineScores: RubricScore[] = [];

  for (const ev of evals) {
    const councilOutput = ev.outputA.mode === "council" ? ev.outputA : ev.outputB;
    const baselineOutput = ev.outputA.mode === "baseline" ? ev.outputA : ev.outputB;

    councilScores.push(councilOutput.scores);
    baselineScores.push(baselineOutput.scores);

    // Determine who the judge preferred (mapped back to real labels)
    const councilIsA = ev.outputA.mode === "council";
    if (ev.preference === "A") {
      if (councilIsA) councilWins++; else baselineWins++;
    } else if (ev.preference === "B") {
      if (councilIsA) baselineWins++; else councilWins++;
    } else {
      ties++;
    }

    const cTotal = Object.values(councilOutput.scores).reduce((a, b) => a + b, 0);
    const bTotal = Object.values(baselineOutput.scores).reduce((a, b) => a + b, 0);
    console.log(
      `\n${ev.promptId}: Council=${cTotal}/25 | Baseline=${bTotal}/25 | ` +
        `Winner=${councilIsA ? (ev.preference === "A" ? "Council" : ev.preference === "B" ? "Baseline" : "Tie") : (ev.preference === "B" ? "Council" : ev.preference === "A" ? "Baseline" : "Tie")}`
    );
    console.log(`  Reason: ${ev.preferenceReason}`);
  }

  // Averages
  const avg = (scores: RubricScore[], key: keyof RubricScore) =>
    (scores.reduce((s, r) => s + r[key], 0) / (scores.length || 1)).toFixed(2);

  console.log("\n" + "-".repeat(70));
  console.log("DIMENSION AVERAGES:");
  console.log(`${"Dimension".padEnd(20)} ${"Council".padEnd(10)} ${"Baseline".padEnd(10)}`);
  for (const dim of ["specificity", "actionability", "depth", "realism", "decisionClarity"] as const) {
    console.log(`${dim.padEnd(20)} ${avg(councilScores, dim).padEnd(10)} ${avg(baselineScores, dim)}`);
  }

  console.log(`\nWin rate: Council ${councilWins} | Baseline ${baselineWins} | Ties ${ties}`);
  console.log("=".repeat(70));
}

async function main() {
  const filter = process.argv[2];
  const pairs = loadResultPairs(filter);

  if (pairs.length === 0) {
    console.error("No result pairs found. Run benchmark first.");
    process.exit(1);
  }

  console.log(`Evaluating ${pairs.length} pair(s)...`);
  mkdirSync(EVAL_DIR, { recursive: true });

  const evals: EvalResult[] = [];

  for (const pair of pairs) {
    console.log(`\n[eval] ${pair.promptId}...`);
    const result = await evaluatePair(pair.promptId, pair.council, pair.baseline);
    evals.push(result);

    writeFileSync(
      join(EVAL_DIR, `${pair.promptId}.json`),
      JSON.stringify(result, null, 2)
    );
  }

  // Save full summary
  writeFileSync(
    join(EVAL_DIR, "_summary.json"),
    JSON.stringify(evals, null, 2)
  );

  printEvalSummary(evals);
}

main().catch(console.error);
