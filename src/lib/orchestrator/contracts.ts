import { z } from "zod";
import {
  type AgentName,
  type ModelTier,
  strategicBriefSchema,
  productSpecSchema,
  legalCheckSchema,
  techSpecSchema,
  designSpecSchema,
  generatedFileSchema,
  verificationReportSchema,
  productScopeOutputSchema,
  techArchitectOutputSchema,
  ceoResponseSchema,
} from "../agents/types";

// ============================================================
// Agent Registry: Maps agent names to schemas + model tiers
// V2: Consolidated agents (17 → 11 LLM + 3 tool)
// ============================================================

export interface AgentConfig {
  name: AgentName;
  phase: number;
  modelTier: ModelTier;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
}

// --- Input Schemas ---

const briefInput = z.object({ brief: strategicBriefSchema });
const briefAndProductInput = z.object({
  brief: strategicBriefSchema,
  productSpec: productSpecSchema,
});
const techAndDesignInput = z.object({
  techSpec: techSpecSchema,
  designSpec: designSpecSchema.optional(),
  productSpec: productSpecSchema.optional(),
});
const designInput = z.object({
  designSpec: designSpecSchema,
  productSpec: productSpecSchema.optional(),
});
const qaWriterInput = z.object({
  productSpec: productSpecSchema,
  techSpec: techSpecSchema,
});
const infraInput = z.object({
  techSpec: techSpecSchema,
  files: z.array(generatedFileSchema).optional(),
});
const contentInput = z.object({
  brief: strategicBriefSchema,
  productSpec: productSpecSchema,
  techSpec: techSpecSchema.optional(),
});
const toolInput = z.object({ files: z.array(generatedFileSchema) });
const ceoInput = z.object({
  message: z.string(),
  projectState: z.string().optional(),
});

// ============================================================
// AGENT REGISTRY — V2 Consolidated
// ============================================================

export const AGENT_REGISTRY: Record<AgentName, AgentConfig> = {
  // --- Phase 0: CEO (always active) ---
  ceo: {
    name: "ceo",
    phase: 0,
    modelTier: "haiku",
    inputSchema: ceoInput,
    outputSchema: ceoResponseSchema,
  },

  // --- Phase 1: Strategic Intake ---
  strategist: {
    name: "strategist",
    phase: 1,
    modelTier: "sonnet",
    inputSchema: z.object({ idea: z.string() }),
    outputSchema: strategicBriefSchema,
  },

  // --- Phase 2: Product Definition (merged PM + Legal) ---
  product_scope: {
    name: "product_scope",
    phase: 2,
    modelTier: "haiku",
    inputSchema: briefInput,
    outputSchema: productScopeOutputSchema,
  },

  // --- Phase 3: Architecture & Design ---
  tech_architect: {
    name: "tech_architect",
    phase: 3,
    modelTier: "sonnet",
    inputSchema: briefAndProductInput,
    outputSchema: techArchitectOutputSchema,
  },
  designer: {
    name: "designer",
    phase: 3,
    modelTier: "sonnet",
    inputSchema: briefAndProductInput,
    outputSchema: designSpecSchema,
  },

  // --- Phase 4: Implementation ---
  fullstack_engineer: {
    name: "fullstack_engineer",
    phase: 4,
    modelTier: "sonnet",
    inputSchema: designInput,
    outputSchema: z.array(generatedFileSchema),
  },
  backend_engineer: {
    name: "backend_engineer",
    phase: 4,
    modelTier: "sonnet",
    inputSchema: techAndDesignInput,
    outputSchema: z.array(generatedFileSchema),
  },
  frontend_engineer: {
    name: "frontend_engineer",
    phase: 4,
    modelTier: "sonnet",
    inputSchema: techAndDesignInput,
    outputSchema: z.array(generatedFileSchema),
  },
  infra_ops: {
    name: "infra_ops",
    phase: 4,
    modelTier: "haiku",
    inputSchema: infraInput,
    outputSchema: z.array(generatedFileSchema),
  },
  qa_writer: {
    name: "qa_writer",
    phase: 4,
    modelTier: "haiku",
    inputSchema: qaWriterInput,
    outputSchema: z.array(generatedFileSchema),
  },

  // --- Phase 5: Verification (tool-based + summary) ---
  qa_execution: {
    name: "qa_execution",
    phase: 5,
    modelTier: "tool",
    inputSchema: toolInput,
    outputSchema: verificationReportSchema.shape.tests,
  },
  security_audit: {
    name: "security_audit",
    phase: 5,
    modelTier: "tool",
    inputSchema: toolInput,
    outputSchema: verificationReportSchema.shape.security,
  },
  sre: {
    name: "sre",
    phase: 5,
    modelTier: "tool",
    inputSchema: toolInput,
    outputSchema: verificationReportSchema.shape.performance,
  },
  verification: {
    name: "verification",
    phase: 5,
    modelTier: "haiku",
    inputSchema: z.object({ report: verificationReportSchema }),
    outputSchema: z.object({ pass: z.boolean(), summary: z.string() }),
  },

  // --- Phase 6: Release (merged Marketing + Docs) ---
  content_writer: {
    name: "content_writer",
    phase: 6,
    modelTier: "haiku",
    inputSchema: contentInput,
    outputSchema: z.array(generatedFileSchema),
  },
};

/** Validate agent input against its registered schema */
export function validateAgentInput(agentName: AgentName, input: unknown): boolean {
  const config = AGENT_REGISTRY[agentName];
  const result = config.inputSchema.safeParse(input);
  return result.success;
}

/** Validate agent output against its registered schema */
export function validateAgentOutput(agentName: AgentName, output: unknown): boolean {
  const config = AGENT_REGISTRY[agentName];
  const result = config.outputSchema.safeParse(output);
  return result.success;
}

/** Get all agents for a given phase */
export function getPhaseAgents(phase: number): AgentConfig[] {
  return Object.values(AGENT_REGISTRY).filter((a) => a.phase === phase);
}
