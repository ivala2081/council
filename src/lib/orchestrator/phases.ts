import type { AgentName, ComplexityClass, PhaseStatus, ProjectStatus } from "../agents/types";

// ============================================================
// Phase Definitions & Transitions — V2 with complexity-based agent selection
// ============================================================

export interface PhaseDefinition {
  phase: number;
  name: string;
  department: string;
  status: ProjectStatus;
  requiresApproval: (complexity: ComplexityClass) => boolean;
  description: string;
}

export const PHASES: PhaseDefinition[] = [
  {
    phase: 1,
    name: "Strategic Intake",
    department: "Strategy Office",
    status: "intake",
    requiresApproval: () => true,
    description: "Council evaluates the idea and produces a StrategicBrief",
  },
  {
    phase: 2,
    name: "Product Definition",
    department: "Product Department",
    status: "product",
    requiresApproval: (c) => c !== "simple",
    description: "Product scope: features, pages, roles, compliance check",
  },
  {
    phase: 3,
    name: "Architecture & Design",
    department: "Engineering & Design",
    status: "design",
    requiresApproval: (c) => c === "complex" || c === "enterprise",
    description: "System architecture with integrated security + UI/UX design specs",
  },
  {
    phase: 4,
    name: "Implementation",
    department: "Engineering Department",
    status: "building",
    requiresApproval: () => false,
    description: "Code generation, infrastructure setup, test writing",
  },
  {
    phase: 5,
    name: "Verification & Hardening",
    department: "Quality Assurance",
    status: "verifying",
    requiresApproval: (c) => c !== "simple",
    description: "Automated tests, security scan, performance check",
  },
  {
    phase: 6,
    name: "Release & Operate",
    department: "Marketing & Docs",
    status: "releasing",
    requiresApproval: (c) => c === "enterprise",
    description: "SEO, documentation, marketing content generation",
  },
];

// ============================================================
// Complexity-Based Agent Selection
// ============================================================

/**
 * Get agents for a phase based on project complexity.
 * Simple projects skip expensive agents and merge backend+frontend.
 */
export function getAgentsForComplexity(
  phase: number,
  complexity: ComplexityClass,
): AgentName[] {
  switch (phase) {
    case 1:
      return ["strategist"];

    case 2:
      return ["product_scope"];

    case 3:
      if (complexity === "simple") {
        // Simple: skip tech_architect, use hardcoded template
        return ["designer"];
      }
      return ["tech_architect", "designer"];

    case 4:
      if (complexity === "simple") {
        // Simple: single fullstack engineer + infra
        return ["fullstack_engineer", "infra_ops"];
      }
      // Standard+: separate engineers + QA
      return ["backend_engineer", "frontend_engineer", "infra_ops", "qa_writer"];

    case 5:
      if (complexity === "simple") {
        // Simple: skip verification entirely
        return [];
      }
      return ["qa_execution", "security_audit", "sre", "verification"];

    case 6:
      return ["content_writer"];

    default:
      return [];
  }
}

/**
 * Check if a phase should be skipped for the given complexity.
 */
export function shouldSkipPhase(phase: number, complexity: ComplexityClass): boolean {
  return getAgentsForComplexity(phase, complexity).length === 0;
}

export function getPhaseDefinition(phase: number): PhaseDefinition | undefined {
  return PHASES.find((p) => p.phase === phase);
}

export function getNextPhase(currentPhase: number): number | null {
  if (currentPhase >= 6) return null;
  return currentPhase + 1;
}

export function phaseRequiresApproval(phase: number, complexity: ComplexityClass): boolean {
  const def = getPhaseDefinition(phase);
  if (!def) return false;
  return def.requiresApproval(complexity);
}

export function phaseToProjectStatus(phase: number): ProjectStatus {
  const def = getPhaseDefinition(phase);
  return def?.status ?? "intake";
}

export function humanGateCount(complexity: ComplexityClass): number {
  return PHASES.filter((p) => p.requiresApproval(complexity)).length;
}

export function createInitialPhases(): Record<number, PhaseStatus> {
  return {
    1: "completed",
    2: "pending",
    3: "pending",
    4: "pending",
    5: "pending",
    6: "pending",
  };
}
