import { z } from "zod";
import {
  type AgentName,
  type ModelTier,
  strategicBriefSchema,
  productSpecSchema,
  legalCheckSchema,
  techSpecSchema,
  designSpecSchema,
  threatModelSchema,
  generatedFileSchema,
  verificationReportSchema,
  deploymentResultSchema,
} from "../agents/types";

// ============================================================
// Agent Registry: Maps agent names to schemas + model tiers
// ============================================================

export interface AgentConfig {
  name: AgentName;
  phase: number;
  modelTier: ModelTier;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
}

// Input schemas for each agent (what they receive)
const strategicBriefInput = z.object({ brief: strategicBriefSchema });
const productInput = z.object({ brief: strategicBriefSchema });
const architectInput = z.object({ brief: strategicBriefSchema, productSpec: productSpecSchema });
const designerInput = z.object({ brief: strategicBriefSchema, productSpec: productSpecSchema });
const securityThreatInput = z.object({ brief: strategicBriefSchema, productSpec: productSpecSchema });
const backendInput = z.object({
  techSpec: techSpecSchema,
  designSpec: designSpecSchema.optional(),
  productSpec: productSpecSchema.optional(),
  threatModel: threatModelSchema.optional(),
});
const frontendInput = z.object({
  techSpec: techSpecSchema,
  designSpec: designSpecSchema.optional(),
  productSpec: productSpecSchema.optional(),
});
const devopsInput = z.object({
  techSpec: techSpecSchema,
  productSpec: productSpecSchema.optional(),
});
const qaWriterInput = z.object({
  productSpec: productSpecSchema,
  techSpec: techSpecSchema,
  threatModel: threatModelSchema.optional(),
});
const deployInput = z.object({ files: z.array(generatedFileSchema).optional().default([]), techSpec: techSpecSchema.optional() });
const marketingInput = z.object({ brief: strategicBriefSchema, productSpec: productSpecSchema });
const docsInput = z.object({ brief: strategicBriefSchema, productSpec: productSpecSchema, techSpec: techSpecSchema.optional() });

// Tool-based agents (no LLM, just automated runs)
const toolInput = z.object({ files: z.array(generatedFileSchema) });

export const AGENT_REGISTRY: Record<AgentName, AgentConfig> = {
  strategist: {
    name: "strategist",
    phase: 1,
    modelTier: "sonnet",
    inputSchema: z.object({ idea: z.string() }),
    outputSchema: strategicBriefSchema,
  },
  product_manager: {
    name: "product_manager",
    phase: 2,
    modelTier: "haiku",
    inputSchema: productInput,
    outputSchema: productSpecSchema,
  },
  legal: {
    name: "legal",
    phase: 2,
    modelTier: "haiku",
    inputSchema: productInput,
    outputSchema: legalCheckSchema,
  },
  architect: {
    name: "architect",
    phase: 3,
    modelTier: "sonnet",
    inputSchema: architectInput,
    outputSchema: techSpecSchema,
  },
  designer: {
    name: "designer",
    phase: 3,
    modelTier: "sonnet",
    inputSchema: designerInput,
    outputSchema: designSpecSchema,
  },
  security_threat: {
    name: "security_threat",
    phase: 3,
    modelTier: "haiku",
    inputSchema: securityThreatInput,
    outputSchema: threatModelSchema,
  },
  backend_engineer: {
    name: "backend_engineer",
    phase: 4,
    modelTier: "sonnet",
    inputSchema: backendInput,
    outputSchema: z.array(generatedFileSchema),
  },
  frontend_engineer: {
    name: "frontend_engineer",
    phase: 4,
    modelTier: "sonnet",
    inputSchema: frontendInput,
    outputSchema: z.array(generatedFileSchema),
  },
  devops: {
    name: "devops",
    phase: 4,
    modelTier: "haiku",
    inputSchema: devopsInput,
    outputSchema: z.array(generatedFileSchema),
  },
  qa_writer: {
    name: "qa_writer",
    phase: 4,
    modelTier: "sonnet",
    inputSchema: qaWriterInput,
    outputSchema: z.array(generatedFileSchema),
  },
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
  devops_deploy: {
    name: "devops_deploy",
    phase: 6,
    modelTier: "haiku",
    inputSchema: deployInput,
    outputSchema: deploymentResultSchema,
  },
  marketing: {
    name: "marketing",
    phase: 6,
    modelTier: "haiku",
    inputSchema: marketingInput,
    outputSchema: z.array(generatedFileSchema),
  },
  support_docs: {
    name: "support_docs",
    phase: 6,
    modelTier: "haiku",
    inputSchema: docsInput,
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
