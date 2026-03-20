import { createHash } from "crypto";
import { MODEL_TIERS } from "../optimization/config";
import type { AgentName, ModelTier } from "../agents/types";
import { AGENT_REGISTRY, type AgentConfig } from "./contracts";
import { withRetry, AgentFailureError, PhaseFailureError } from "./recovery";

// ============================================================
// Agent Dispatcher: Fan-out/fan-in with retry + audit logging
// ============================================================

export interface DispatchResult {
  agentName: AgentName;
  output: unknown;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  confidence?: number;
}

/** Model ID resolution */
function resolveModel(tier: ModelTier): string {
  switch (tier) {
    case "haiku":
      return MODEL_TIERS.utility;
    case "sonnet":
      return MODEL_TIERS.balanced;
    case "deepseek":
      // DeepSeek V3 — placeholder until integrated
      // Falls back to Haiku for now
      return MODEL_TIERS.utility;
    case "tool":
      return "tool"; // Not an LLM
    default:
      return MODEL_TIERS.balanced;
  }
}

/** Hash input/output for audit trail */
function hashData(data: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 16);
}

/** Call a single agent with retry + validation */
export async function dispatchAgent(
  agentName: AgentName,
  input: unknown,
  projectId: string,
): Promise<DispatchResult> {
  const config = AGENT_REGISTRY[agentName];
  if (!config) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  // Validate input
  const inputResult = config.inputSchema.safeParse(input);
  if (!inputResult.success) {
    throw new Error(
      `Invalid input for ${agentName}: ${inputResult.error.message}`
    );
  }

  // Tool-based agents (Phase 5 automated tools)
  if (config.modelTier === "tool") {
    return dispatchToolAgent(config, input);
  }

  const primaryModel = resolveModel(config.modelTier);
  const startTime = Date.now();

  const { result: llmResult, modelUsed } = await withRetry(
    async (model: string) => {
      return await callLLM(model, config, inputResult.data);
    },
    primaryModel,
  );

  const durationMs = Date.now() - startTime;

  // Validate output
  const outputResult = config.outputSchema.safeParse(llmResult.parsed);
  if (!outputResult.success) {
    throw new AgentFailureError(
      modelUsed,
      `Output validation failed for ${agentName}: ${outputResult.error.message}`,
    );
  }

  return {
    agentName,
    output: outputResult.data,
    modelUsed,
    tokensUsed: llmResult.tokensUsed,
    costUsd: llmResult.costUsd,
    durationMs,
    confidence: llmResult.confidence,
  };
}

/** Fan-out: dispatch multiple agents in parallel, collect results */
export async function dispatchPhaseAgents(
  agentNames: AgentName[],
  inputs: Record<string, unknown>,
  projectId: string,
): Promise<{ results: DispatchResult[]; failures: Array<{ agent: AgentName; error: string }> }> {
  const promises = agentNames.map((name) =>
    dispatchAgent(name, inputs[name] ?? inputs, projectId)
      .then((result) => ({ ok: true as const, result }))
      .catch((error) => ({
        ok: false as const,
        agent: name,
        error: error instanceof Error ? error.message : String(error),
      }))
  );

  const settled = await Promise.all(promises);

  const results: DispatchResult[] = [];
  const failures: Array<{ agent: AgentName; error: string }> = [];

  for (const item of settled) {
    if (item.ok) {
      results.push(item.result);
    } else {
      failures.push({ agent: item.agent, error: item.error });
    }
  }

  return { results, failures };
}

// --- LLM Call (Anthropic SDK) ---

interface LLMResult {
  parsed: unknown;
  tokensUsed: number;
  costUsd: number;
  confidence?: number;
}

/** Extract JSON from LLM response — handles markdown fences, raw JSON, and edge cases */
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

async function callLLM(
  model: string,
  config: AgentConfig,
  input: unknown,
): Promise<LLMResult> {
  // Dynamic import to avoid loading Anthropic SDK in non-LLM contexts
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const client = new Anthropic();

  const systemPrompt = getAgentSystemPrompt(config.name);
  const userMessage = JSON.stringify(input);

  const response = await client.messages.create({
    model,
    max_tokens: getMaxTokens(config.modelTier, config.name),
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Process this input and respond with valid JSON matching the required schema.\n\nInput:\n${userMessage}`,
      },
    ],
  });

  // Extract text content
  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error(`No text response from ${config.name}`);
  }

  // Parse JSON from response with robust extraction
  let parsed: unknown;
  try {
    parsed = extractAndParseJSON(textContent.text);
  } catch (err) {
    const preview = textContent.text.substring(0, 200).replace(/\n/g, "\\n");
    throw new Error(
      `Failed to parse JSON from ${config.name}: ${err instanceof Error ? err.message : String(err)} | Preview: ${preview}`,
    );
  }

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const cacheRead = response.usage?.cache_read_input_tokens ?? 0;
  const cacheWrite = response.usage?.cache_creation_input_tokens ?? 0;
  const tokensUsed = inputTokens + outputTokens;

  // Calculate cost from Anthropic pricing
  const { ANTHROPIC_PRICING } = await import("../optimization/config");
  const pricing = ANTHROPIC_PRICING[model as keyof typeof ANTHROPIC_PRICING];
  let costUsd = 0;
  if (pricing) {
    const regularInput = Math.max(0, inputTokens - cacheRead - cacheWrite);
    costUsd =
      (regularInput / 1_000_000) * pricing.inputPerMillion +
      (cacheRead / 1_000_000) * pricing.cacheReadPerMillion +
      (cacheWrite / 1_000_000) * pricing.cacheWritePerMillion +
      (outputTokens / 1_000_000) * pricing.outputPerMillion;
  }

  return {
    parsed,
    tokensUsed,
    costUsd,
  };
}

// Tool-based agents don't call LLMs
async function dispatchToolAgent(
  config: AgentConfig,
  input: unknown,
): Promise<DispatchResult> {
  // Placeholder: Phase 5 tools (Vitest, Semgrep, Lighthouse) will be implemented in Sprint 4
  return {
    agentName: config.name,
    output: null,
    modelUsed: "tool",
    tokensUsed: 0,
    costUsd: 0,
    durationMs: 0,
  };
}

/** Max output tokens — code-gen agents get higher budgets */
function getMaxTokens(tier: ModelTier, agentName?: AgentName): number {
  // Code-generation and docs agents need more headroom for multi-file output
  const highTokenAgents: AgentName[] = [
    "backend_engineer",
    "frontend_engineer",
    "qa_writer",
    "support_docs",
    "marketing",
  ];
  if (agentName && highTokenAgents.includes(agentName)) {
    return 32768;
  }

  switch (tier) {
    case "haiku":
      return 4096;
    case "sonnet":
      return 8192;
    case "deepseek":
      return 8192;
    default:
      return 4096;
  }
}

/** Get system prompt for each agent — imports from dedicated prompt files */
function getAgentSystemPrompt(agentName: AgentName): string {
  // Lazy-load prompts to avoid circular imports and keep dispatcher light
  // Phase 2-3 agents have full prompts; Phase 4+ use inline stubs until Sprint 3
  const prompts: Partial<Record<AgentName, () => string>> = {
    product_manager: () => {
      const { PRODUCT_MANAGER_SYSTEM_PROMPT } = require("../agents/product-manager");
      return PRODUCT_MANAGER_SYSTEM_PROMPT;
    },
    legal: () => {
      const { LEGAL_SYSTEM_PROMPT } = require("../agents/legal");
      return LEGAL_SYSTEM_PROMPT;
    },
    architect: () => {
      const { ARCHITECT_SYSTEM_PROMPT } = require("../agents/architect");
      return ARCHITECT_SYSTEM_PROMPT;
    },
    designer: () => {
      const { DESIGNER_SYSTEM_PROMPT } = require("../agents/designer");
      return DESIGNER_SYSTEM_PROMPT;
    },
    security_threat: () => {
      const { SECURITY_THREAT_SYSTEM_PROMPT } = require("../agents/security");
      return SECURITY_THREAT_SYSTEM_PROMPT;
    },
    backend_engineer: () => {
      const { BACKEND_ENGINEER_SYSTEM_PROMPT } = require("../agents/backend-engineer");
      return BACKEND_ENGINEER_SYSTEM_PROMPT;
    },
    frontend_engineer: () => {
      const { FRONTEND_ENGINEER_SYSTEM_PROMPT } = require("../agents/frontend-engineer");
      return FRONTEND_ENGINEER_SYSTEM_PROMPT;
    },
    devops: () => {
      const { DEVOPS_SYSTEM_PROMPT } = require("../agents/devops");
      return DEVOPS_SYSTEM_PROMPT;
    },
    qa_writer: () => {
      const { QA_WRITER_SYSTEM_PROMPT } = require("../agents/qa-writer");
      return QA_WRITER_SYSTEM_PROMPT;
    },
    devops_deploy: () => {
      const { DEVOPS_DEPLOY_SYSTEM_PROMPT } = require("../agents/devops-deploy");
      return DEVOPS_DEPLOY_SYSTEM_PROMPT;
    },
    marketing: () => {
      const { MARKETING_SYSTEM_PROMPT } = require("../agents/marketing");
      return MARKETING_SYSTEM_PROMPT;
    },
    support_docs: () => {
      const { SUPPORT_DOCS_SYSTEM_PROMPT } = require("../agents/support-docs");
      return SUPPORT_DOCS_SYSTEM_PROMPT;
    },
  };

  // Try dedicated prompt file first, then fallback
  const promptFn = prompts[agentName];
  if (promptFn) return promptFn();

  return `You are the ${agentName} agent for AiCompanyOS. Process the input and respond with valid JSON.`;
}
