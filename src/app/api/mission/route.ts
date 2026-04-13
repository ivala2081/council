import { anthropic } from "@ai-sdk/anthropic";
import { streamText, Output } from "ai";
import { supabase } from "@/lib/supabase-server";
import { STRATEGIST_SYSTEM_PROMPT, STRATEGIST_CONCISE_PROMPT } from "@/lib/agents/strategist";
import { strategicBriefSchema, conciseBriefSchema } from "@/lib/agents/types";
import {
  DEFAULT_MODEL,
  TOKEN_BUDGETS,
  ADAPTIVE_TOKEN_BUDGETS,
  calculateCostUsd,
  formatUsageLog,
  MODEL_TIERS,
} from "@/lib/optimization/config";
import type { ModelId } from "@/lib/optimization/config";
import { classifyQuery, buildEnrichedPrompt } from "@/lib/optimization/query-classifier";
import { buildIncrementalContext } from "@/lib/optimization/incremental";
import { getCompactedMemory, getPreviousBrief } from "@/lib/optimization/memory";
import { computeDelta } from "@/lib/threads/delta";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  const { prompt, companyId, mode = "full", threadId, ownerToken } = body as {
    prompt: string;
    companyId?: string;
    mode?: string;
    threadId?: string;
    ownerToken?: string;
  };
  const isConcise = mode === "concise";
  const isDeep = mode === "deep"; // Extended thinking mode

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 10) {
    return Response.json(
      { error: "Prompt must be at least 10 characters" },
      { status: 400 }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitResult = await checkRateLimit(ip, ownerToken);
  if (!rateLimitResult.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Maximum 10 briefs per day.", resetsAt: rateLimitResult.resetsAt.toISOString() },
      { status: 429 }
    );
  }

  // --- Thread management ---
  let activeThreadId = threadId || null;
  let runNumber = 1;
  let previousBriefForDelta: Record<string, unknown> | null = null;

  if (activeThreadId) {
    // Continuing an existing thread — fetch previous run for context
    const { data: prevRuns } = await supabase
      .from("missions")
      .select("result, run_number")
      .eq("thread_id", activeThreadId)
      .eq("status", "completed")
      .order("run_number", { ascending: false })
      .limit(1);

    if (prevRuns && prevRuns.length > 0) {
      previousBriefForDelta = prevRuns[0].result as Record<string, unknown>;
      runNumber = (prevRuns[0].run_number ?? 1) + 1;
    }
  } else if (ownerToken) {
    // New thread — auto-create from first prompt
    const threadName = prompt.trim().slice(0, 80);
    const { data: thread } = await supabase
      .from("threads")
      .insert({
        name: threadName,
        owner_token: ownerToken,
      })
      .select("id")
      .single();

    if (thread) {
      activeThreadId = thread.id;
    }
  }

  // Create mission record
  const { data: mission, error: dbError } = await supabase
    .from("missions")
    .insert({
      prompt: prompt.trim(),
      company_id: companyId || null,
      thread_id: activeThreadId,
      run_number: runNumber,
      pipeline_mode: isDeep ? "deep" : isConcise ? "concise" : "single",
      status: "running",
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("[mission] DB error:", dbError);
  }

  const missionId = mission?.id;
  const startTime = Date.now();
  // Deep mode uses the same balanced model with extended thinking enabled
  const model = DEFAULT_MODEL;

  // --- Phase 2: Query Classification (zero-cost) ---
  const classification = classifyQuery(prompt.trim());

  // --- Phase 3+4: Context enrichment ---
  let previousContext: string | null = null;

  // Thread-based context (P0): use previous run in this thread
  if (previousBriefForDelta) {
    previousContext = buildIncrementalContext(previousBriefForDelta);
  }
  // Legacy company-based context (still supported)
  else if (companyId) {
    const [memoryContext, previousBrief] = await Promise.all([
      getCompactedMemory(companyId),
      getPreviousBrief(companyId),
    ]);
    previousContext = memoryContext || buildIncrementalContext(previousBrief);
  }

  // --- Build enriched user message ---
  const enrichedPrompt = isConcise
    ? prompt.trim() // Concise mode: no depth hints needed (already minimal)
    : buildEnrichedPrompt(prompt.trim(), classification, previousContext);

  // --- Select token budget ---
  const systemPrompt = isConcise ? STRATEGIST_CONCISE_PROMPT : STRATEGIST_SYSTEM_PROMPT;
  const schema = isConcise ? conciseBriefSchema : strategicBriefSchema;

  const deepBudget = TOKEN_BUDGETS.strategistDeep;
  const budget = isDeep
    ? { maxOutputTokens: deepBudget.maxOutputTokens, temperature: deepBudget.temperature }
    : isConcise
    ? TOKEN_BUDGETS.strategistConcise
    : ADAPTIVE_TOKEN_BUDGETS[classification.queryType];

  // --- Log optimization decisions ---
  console.log(
    `[optimize] query=${classification.queryType} confidence=${classification.confidence} ` +
    `tokens=${budget.maxOutputTokens} hasContext=${!!previousContext} mode=${mode}`
  );

  // Deep thinking: extended thinking is incompatible with Output.object (structured output).
  // In deep mode we rely on the system prompt's JSON instruction + manual parsing.
  const streamOptions = {
    model: anthropic(model),

    // System prompt with cache control — cached after first request (5min TTL)
    // Saves ~90% on repeated system prompt input tokens
    messages: [
      {
        role: "system" as const,
        content: systemPrompt,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      {
        role: "user" as const,
        content: enrichedPrompt,
      },
    ],

    maxOutputTokens: budget.maxOutputTokens,
    temperature: budget.temperature,

    // Extended thinking: only in deep mode (incompatible with Output.object)
    ...(isDeep
      ? {
          providerOptions: {
            anthropic: {
              thinking: {
                type: "enabled" as const,
                budgetTokens: deepBudget.thinkingBudgetTokens,
              },
            },
          },
        }
      : {
          // Structured output — forces valid JSON matching schema, no markdown fences
          output: Output.object({ schema }),
        }),
  };

  const result = streamText({
    ...streamOptions,

    async onFinish({ text, usage }) {
      const durationMs = Date.now() - startTime;
      const costUsd = calculateCostUsd(model as ModelId, usage);

      // Enhanced logging with optimization context
      console.log(
        formatUsageLog(missionId, model as ModelId, usage, durationMs) +
        ` queryType=${classification.queryType}` +
        ` budgetUsed=${usage.outputTokens ?? 0}/${budget.maxOutputTokens}` +
        (previousContext ? " withContext=true" : "")
      );

      if (!missionId) return;

      // Parse result — structured output should produce clean JSON
      let parsedResult = null;
      try {
        const cleaned = text
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();
        parsedResult = JSON.parse(cleaned);
      } catch {
        // Save raw text if JSON parse fails
      }

      // --- Compute delta if this is a follow-up run ---
      let delta = null;
      if (parsedResult && previousBriefForDelta) {
        delta = computeDelta(previousBriefForDelta, parsedResult);
      }

      // Update mission with result, cost, and delta
      await supabase
        .from("missions")
        .update({
          status: parsedResult ? "completed" : "failed",
          result: parsedResult,
          delta,
          total_cost_usd: costUsd,
          model_costs: {
            model,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
            cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
            costUsd,
            queryType: classification.queryType,
            tokenBudget: budget.maxOutputTokens,
            hadPreviousContext: !!previousContext,
            deepThinking: isDeep,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", missionId);

      // --- Update thread with latest verdict/score ---
      if (activeThreadId && parsedResult) {
        const verdict = parsedResult.verdict as Record<string, unknown> | undefined;
        await supabase
          .from("threads")
          .update({
            latest_verdict: (verdict?.verdict as string) ?? null,
            latest_score: (verdict?.councilScore as number) ?? null,
            run_count: runNumber,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeThreadId);
      }

      // Save agent output
      await supabase.from("agent_outputs").insert({
        mission_id: missionId,
        agent_name: "strategist",
        step_order: 1,
        output: parsedResult || { raw: text },
        model,
        tokens_in: usage.inputTokens ?? 0,
        tokens_out: usage.outputTokens ?? 0,
        cost_usd: costUsd,
        duration_ms: durationMs,
      });

      // --- Phase 4: Extract key findings for future memory compaction ---
      if (parsedResult && companyId) {
        await extractKeyFindings(missionId, companyId, parsedResult);
      }
    },
  });

  const headers: Record<string, string> = {};
  if (missionId) headers["X-Mission-Id"] = missionId;
  if (activeThreadId) headers["X-Thread-Id"] = activeThreadId;

  const response = result.toTextStreamResponse({ headers });

  return response;
}

/**
 * Phase 4: Extract key findings from a completed brief
 * and save them for future memory compaction.
 */
async function extractKeyFindings(
  missionId: string,
  companyId: string,
  brief: Record<string, unknown>
) {
  const findings: {
    mission_id: string;
    company_id: string;
    content: string;
    section: string;
    finding_type: string;
    source_agent: string;
  }[] = [];

  try {
    // Extract verdict as a finding
    const verdict = brief.verdict as Record<string, unknown> | undefined;
    if (verdict?.summary) {
      findings.push({
        mission_id: missionId,
        company_id: companyId,
        content: `Verdict: ${verdict.verdict} (score: ${verdict.councilScore}). ${verdict.summary}`,
        section: "verdict",
        finding_type: "assessment",
        source_agent: "strategist",
      });
    }

    // Extract critical risks
    const risks = brief.whyThisMayFail as string[] | undefined;
    if (risks) {
      for (const risk of risks.slice(0, 2)) {
        findings.push({
          mission_id: missionId,
          company_id: companyId,
          content: risk,
          section: "risks",
          finding_type: "risk",
          source_agent: "strategist",
        });
      }
    }

    // Extract critical assumptions
    const assumptions = brief.assumptionLedger as Array<{
      assumption: string;
      confidence: string;
    }> | undefined;
    if (assumptions) {
      const speculative = assumptions.filter((a) => a.confidence === "speculative");
      for (const a of speculative.slice(0, 2)) {
        findings.push({
          mission_id: missionId,
          company_id: companyId,
          content: a.assumption,
          section: "assumptions",
          finding_type: "assumption",
          source_agent: "strategist",
        });
      }
    }

    if (findings.length > 0) {
      const { error } = await supabase.from("key_findings").insert(findings);
      if (error) {
        console.error("[key_findings] Insert error:", error);
      }
    }
  } catch (err) {
    // Non-blocking: don't fail the mission if key_findings extraction fails
    console.error("[key_findings] Extraction error:", err);
  }
}
