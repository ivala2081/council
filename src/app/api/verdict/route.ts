import { anthropic } from "@ai-sdk/anthropic";
import { streamText, Output } from "ai";
import { readFileSync } from "fs";
import { join } from "path";
import { v2VerdictSchema } from "@/lib/agents/types";
import { calculateCostUsd, formatUsageLog, MODEL_TIERS } from "@/lib/optimization/config";
import type { ModelId } from "@/lib/optimization/config";

export const maxDuration = 60;

// Supabase is optional — verdict works without DB
const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
let supabase: ReturnType<typeof import("@supabase/supabase-js").createClient> | null = null;
if (hasSupabase) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Load v2 prompt config once at module level
const PROMPT_CONFIG = JSON.parse(
  readFileSync(join(process.cwd(), "prompts/v2-system-prompt.json"), "utf-8")
);
const SCHEMA_CONFIG = JSON.parse(
  readFileSync(join(process.cwd(), "prompts/v2-output-schema.json"), "utf-8")
);

const SYSTEM_PROMPT =
  PROMPT_CONFIG.system_prompt +
  "\n\n## OUTPUT SCHEMA\n\nYou MUST respond with valid JSON matching this exact schema:\n\n```json\n" +
  JSON.stringify(SCHEMA_CONFIG.verdict_schema, null, 2) +
  "\n```";

const MODEL = MODEL_TIERS.balanced;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt, threadId, ownerToken } = body as {
    prompt: string;
    threadId?: string;
    ownerToken?: string;
  };

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return Response.json({ error: "Tell me your idea (at least 3 characters)" }, { status: 400 });
  }

  // Rate limit (skip if no Supabase)
  if (supabase) {
    const { checkRateLimit } = require("@/lib/rate-limit");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitResult = await checkRateLimit(ip, ownerToken);
    if (!rateLimitResult.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Max 10 verdicts per day.", resetsAt: rateLimitResult.resetsAt.toISOString() },
        { status: 429 }
      );
    }
  }

  // Thread + mission management (skip if no Supabase)
  let activeThreadId = threadId || null;
  let runNumber = 1;
  let missionId: string | null = null;

  if (supabase) {
    try {
      if (activeThreadId) {
        const { data: prevRuns } = await supabase
          .from("missions")
          .select("run_number")
          .eq("thread_id", activeThreadId)
          .eq("status", "completed")
          .order("run_number", { ascending: false })
          .limit(1);
        if (prevRuns && prevRuns.length > 0) {
          runNumber = (prevRuns[0].run_number ?? 1) + 1;
        }
      } else if (ownerToken) {
        const threadName = prompt.trim().slice(0, 80);
        const { data: thread } = await supabase
          .from("threads")
          .insert({ name: threadName, owner_token: ownerToken })
          .select("id")
          .single();
        if (thread) activeThreadId = thread.id;
      }

      const { data: mission } = await supabase
        .from("missions")
        .insert({
          prompt: prompt.trim(),
          thread_id: activeThreadId,
          run_number: runNumber,
          pipeline_mode: "verdict",
          status: "running",
        })
        .select("id")
        .single();
      missionId = mission?.id ?? null;
    } catch (err) {
      console.error("[verdict] DB setup error (continuing without DB):", err);
    }
  }

  const startTime = Date.now();

  const result = streamText({
    model: anthropic(MODEL),
    messages: [
      {
        role: "system" as const,
        content: SYSTEM_PROMPT,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      {
        role: "user" as const,
        content: prompt.trim(),
      },
    ],
    output: Output.object({ schema: v2VerdictSchema }),
    maxOutputTokens: 4096,
    temperature: 0.3,

    async onFinish({ text, usage }) {
      if (!supabase) return;

      const durationMs = Date.now() - startTime;
      const costUsd = calculateCostUsd(MODEL as ModelId, usage);

      console.log(
        formatUsageLog(missionId, MODEL as ModelId, usage, durationMs) + " mode=verdict"
      );

      if (!missionId) return;

      let parsedResult = null;
      try {
        const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        parsedResult = JSON.parse(cleaned);
      } catch { /* save raw */ }

      try {
        await supabase
          .from("missions")
          .update({
            status: parsedResult ? "completed" : "failed",
            result: parsedResult,
            total_cost_usd: costUsd,
            model_costs: {
              model: MODEL,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              costUsd,
              mode: "verdict",
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", missionId);

        if (activeThreadId && parsedResult) {
          await supabase
            .from("threads")
            .update({
              latest_verdict: parsedResult.verdict ?? null,
              latest_score: parsedResult.confidence?.score ?? null,
              run_count: runNumber,
              updated_at: new Date().toISOString(),
            })
            .eq("id", activeThreadId);
        }

        await supabase.from("agent_outputs").insert({
          mission_id: missionId,
          agent_name: "verdict_engine",
          step_order: 1,
          output: parsedResult || { raw: text },
          model: MODEL,
          tokens_in: usage.inputTokens ?? 0,
          tokens_out: usage.outputTokens ?? 0,
          cost_usd: costUsd,
          duration_ms: durationMs,
        });
      } catch (err) {
        console.error("[verdict] DB save error:", err);
      }
    },
  });

  const headers: Record<string, string> = {};
  if (missionId) headers["X-Mission-Id"] = missionId;
  if (activeThreadId) headers["X-Thread-Id"] = activeThreadId;

  return result.toTextStreamResponse({ headers });
}
