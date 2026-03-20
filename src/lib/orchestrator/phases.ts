import type { AgentName, ComplexityClass, PhaseStatus, ProjectStatus } from "../agents/types";

// ============================================================
// Phase Definitions & Transitions
// ============================================================

export interface PhaseDefinition {
  phase: number;
  name: string;
  status: ProjectStatus;
  agents: AgentName[];
  requiresApproval: (complexity: ComplexityClass) => boolean;
  description: string;
}

export const PHASES: PhaseDefinition[] = [
  {
    phase: 1,
    name: "Strategic Intake",
    status: "intake",
    agents: ["strategist"],
    requiresApproval: () => true, // Always — user approves scope
    description: "Council evaluates the idea and produces a StrategicBrief",
  },
  {
    phase: 2,
    name: "Product Definition",
    status: "product",
    agents: ["product_manager", "legal"],
    requiresApproval: (c) => c !== "simple",
    description: "Product Manager defines features/pages/roles, Legal scans compliance",
  },
  {
    phase: 3,
    name: "Architecture & Design",
    status: "design",
    agents: ["architect", "designer", "security_threat"],
    requiresApproval: (c) => c === "complex" || c === "enterprise",
    description: "Architect designs system, Designer creates UI specs, Security models threats",
  },
  {
    phase: 4,
    name: "Implementation",
    status: "building",
    agents: ["backend_engineer", "frontend_engineer", "devops", "qa_writer"],
    requiresApproval: () => false, // Automatic gate (lint/type/test)
    description: "Engineers generate code, DevOps configures infra, QA writes tests",
  },
  {
    phase: 5,
    name: "Verification & Hardening",
    status: "verifying",
    agents: ["qa_execution", "security_audit", "sre"],
    requiresApproval: (c) => c !== "simple",
    description: "Run tests, security scan, performance check",
  },
  {
    phase: 6,
    name: "Release & Operate",
    status: "releasing",
    agents: ["devops_deploy", "marketing", "support_docs"],
    requiresApproval: (c) => c === "enterprise",
    description: "Deploy to production, generate marketing/docs",
  },
];

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

/** Map phase number → project status when that phase is active */
export function phaseToProjectStatus(phase: number): ProjectStatus {
  const def = getPhaseDefinition(phase);
  return def?.status ?? "intake";
}

/** Determine how many human gates for a given complexity class */
export function humanGateCount(complexity: ComplexityClass): number {
  return PHASES.filter((p) => p.requiresApproval(complexity)).length;
}

/** Initial phases map for a new project */
export function createInitialPhases(): Record<number, PhaseStatus> {
  return {
    1: "completed", // Council already done when project is created
    2: "pending",
    3: "pending",
    4: "pending",
    5: "pending",
    6: "pending",
  };
}
