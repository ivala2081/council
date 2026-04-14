/**
 * Council v2 Bias Test — Confidence Calibration Probe
 *
 * Hypothesis (2026-04-14): Council v2.3.1 prompt anchors PIVOT at 72% confidence.
 * 4/4 live user tests returned PIVOT 72% across wildly different inputs.
 * This harness probes the anchor systematically.
 *
 * Design:
 *   - 12 ideas spanning clear DON'T / clear GO / genuine PIVOT
 *   - N repeats per idea (default 3) to measure variance
 *   - Prompt-only (no tools triggered; same as v2-eval)
 *   - Output: per-idea confidence spread, anchor-cluster histogram,
 *     evidence-tag tally (especially training_data fallback rate).
 *
 * Usage:
 *   npx tsx benchmark/bias-test.ts              # 12 ideas × 3 runs = 36 calls
 *   npx tsx benchmark/bias-test.ts --runs 1     # 1 run per idea (smoke)
 *   npx tsx benchmark/bias-test.ts --filter bad # only the "bad" bucket
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

// --- Schemas (mirror v2-eval.ts) ---

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

// --- Probe set: 12 ideas, mixed expectations ---

type Bucket = "bad" | "good" | "pivot";

interface Probe {
  id: string;
  bucket: Bucket;
  expected: "GO" | "PIVOT" | "DONT";
  input: string;
  note: string;
}

const PROBES: Probe[] = [
  // 4 clearly bad (expected DONT)
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

  // 4 clearly good (expected GO)
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

  // 4 genuine pivots (expected PIVOT with varying confidence)
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

// --- Prompt / client setup (mirror v2-eval.ts) ---

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

const client = new Anthropic();

async function callOnce(userMessage: string, retry = true): Promise<Verdict | null> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: [{
        type: "text" as const,
        text: SYSTEM_TEXT,
        cache_control: { type: "ephemeral" as const },
      }],
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const rawText = textBlocks.map((b) => (b as { text: string }).text).join("\n");
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

    const parsed = VerdictSchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    if (retry && err instanceof Anthropic.APIError && (err.status === 429 || err.status >= 500)) {
      console.log(`    [retry] ${err.status} — waiting 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      return callOnce(userMessage, false);
    }
    console.log(`    [error] ${err instanceof Error ? err.message : String(err)}`);
    return null;
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
}

function parseArgs() {
  let runs = 3;
  let filter: Bucket | null = null;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--runs") runs = parseInt(process.argv[++i], 10);
    else if (process.argv[i] === "--filter") {
      const f = process.argv[++i];
      if (f === "bad" || f === "good" || f === "pivot") filter = f;
    }
  }
  return { runs, filter };
}

async function main() {
  const { runs, filter } = parseArgs();
  const probes = filter ? PROBES.filter((p) => p.bucket === filter) : PROBES;

  console.log(`Council v2 Bias Test`);
  console.log(`Model: ${MODEL} | Temp: ${TEMPERATURE} | Probes: ${probes.length} × ${runs} runs = ${probes.length * runs} calls`);
  console.log(`Prompt version: ${PROMPT_CONFIG.meta.version}`);
  console.log("=".repeat(70));

  const all: Run[] = [];

  for (const probe of probes) {
    console.log(`\n[${probe.id}] ${probe.bucket.toUpperCase()} / expected ${probe.expected}`);
    console.log(`      "${probe.input.slice(0, 80)}${probe.input.length > 80 ? "..." : ""}"`);
    console.log(`      note: ${probe.note}`);

    for (let r = 0; r < runs; r++) {
      const parsed = await callOnce(probe.input);
      const row: Run = {
        probeId: probe.id,
        bucket: probe.bucket,
        expected: probe.expected,
        runIndex: r + 1,
        verdict: parsed?.verdict ?? null,
        confidence: parsed?.confidence.score ?? null,
        evidenceTypes: parsed?.reasons.map((x) => x.evidence.type) ?? [],
      };
      all.push(row);
      const hit = row.verdict === probe.expected ? "✓" : "✗";
      console.log(`      run ${r + 1}: ${row.verdict ?? "ERROR"} @ ${row.confidence ?? "?"}%  ${hit}  [${row.evidenceTypes.join(", ")}]`);
    }
  }

  // --- Summary ---

  console.log("\n" + "=".repeat(70));
  console.log("BIAS TEST SUMMARY");
  console.log("=".repeat(70));

  // Verdict accuracy per bucket
  for (const bucket of ["bad", "good", "pivot"] as Bucket[]) {
    const rows = all.filter((r) => r.bucket === bucket);
    if (rows.length === 0) continue;
    const hits = rows.filter((r) => r.verdict === r.expected).length;
    console.log(`${bucket.padEnd(6)} verdict match: ${hits}/${rows.length} (${((hits / rows.length) * 100).toFixed(0)}%)`);
  }

  // Confidence cluster histogram (5-pt buckets)
  console.log("\nConfidence histogram (all runs):");
  const buckets: Record<string, number> = {};
  for (const r of all) {
    if (r.confidence == null) continue;
    const key = `${Math.floor(r.confidence / 5) * 5}-${Math.floor(r.confidence / 5) * 5 + 4}`;
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  const keys = Object.keys(buckets).sort((a, b) => parseInt(a) - parseInt(b));
  const maxCount = Math.max(...Object.values(buckets));
  for (const k of keys) {
    const bar = "█".repeat(Math.round((buckets[k] / maxCount) * 30));
    console.log(`  ${k.padEnd(7)} ${String(buckets[k]).padStart(3)}  ${bar}`);
  }

  // Variance per probe (std dev of confidence)
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

  // 72% anchor check
  const at72 = all.filter((r) => r.confidence === 72).length;
  const nearAnchor = all.filter((r) => r.confidence != null && r.confidence >= 70 && r.confidence <= 74).length;
  console.log(`\n72% anchor check:`);
  console.log(`  Exactly 72%:      ${at72}/${all.length} (${((at72 / all.length) * 100).toFixed(0)}%)`);
  console.log(`  Within 70-74%:    ${nearAnchor}/${all.length} (${((nearAnchor / all.length) * 100).toFixed(0)}%)`);
  console.log(`  Healthy threshold: < 25% within 70-74 bucket across diverse inputs`);

  // Evidence tag distribution
  console.log("\nEvidence tag distribution (all reasons):");
  const tags: Record<string, number> = {};
  for (const r of all) for (const t of r.evidenceTypes) tags[t] = (tags[t] ?? 0) + 1;
  const totalTags = Object.values(tags).reduce((a, b) => a + b, 0);
  for (const [t, c] of Object.entries(tags).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(15)} ${String(c).padStart(3)}  (${((c / totalTags) * 100).toFixed(0)}%)`);
  }
  const trainPct = ((tags["training_data"] ?? 0) / totalTags) * 100;
  console.log(`  training_data rate: ${trainPct.toFixed(0)}% — target < 20% when Exa is available`);

  // Save
  const resultsDir = join(__dirname, "results");
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = join(resultsDir, `bias-test-${timestamp}.json`);
  writeFileSync(filePath, JSON.stringify({
    meta: {
      timestamp: new Date().toISOString(),
      model: MODEL,
      prompt_version: PROMPT_CONFIG.meta.version,
      probes: probes.length,
      runs_per_probe: runs,
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
