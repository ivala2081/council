import { supabase } from "../supabase-server";
import type {
  AgentName,
  ComplexityClass,
  GeneratedFile,
  PhaseStatus,
  PhaseUpdate,
  ProjectState,
  StrategicBrief,
} from "../agents/types";
import { PHASES, getPhaseDefinition, getNextPhase, phaseRequiresApproval, phaseToProjectStatus, createInitialPhases, getAgentsForComplexity } from "./phases";
import { dispatchPhaseAgents, type DispatchResult } from "./dispatcher";
import { PhaseFailureError } from "./recovery";

// ============================================================
// AiCompanyOS Orchestrator — State Machine
// ============================================================

/** Create a new project from a Council thread */
export async function createProject(
  threadId: string,
  ownerToken: string,
  name: string,
  description: string,
  strategicBrief: StrategicBrief,
): Promise<string> {
  // Determine complexity from brief (uses routing data if available)
  const complexityClass = inferComplexity(strategicBrief);
  const riskLevel = inferRiskLevel(strategicBrief);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      thread_id: threadId,
      owner_token: ownerToken,
      name,
      description,
      status: "intake",
      current_phase: 1,
      complexity_class: complexityClass,
      risk_level: riskLevel,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);

  // Save the StrategicBrief as Phase 1 output
  await savePhaseOutput(data.id, 1, "strategist", strategicBrief);

  // Mark Phase 1 as completed
  await updateProjectPhase(data.id, 1, "completed");

  return data.id;
}

/** Run the build pipeline for a project. Yields PhaseUpdate events for SSE streaming. */
export async function* runProject(projectId: string): AsyncGenerator<PhaseUpdate> {
  const state = await loadProjectState(projectId);

  // Skip already-completed phases
  let currentPhase = 1;
  while (currentPhase <= 6 && state.phases[currentPhase] === "completed") {
    const next = getNextPhase(currentPhase);
    if (!next) {
      yield { phase: currentPhase, status: "completed", timestamp: Date.now() };
      return;
    }
    currentPhase = next;
  }

  const complexity = await getProjectComplexity(projectId);

  while (currentPhase <= 6) {
    const phaseDef = getPhaseDefinition(currentPhase);
    if (!phaseDef) break;

    // Update project status
    await updateProjectStatus(projectId, phaseToProjectStatus(currentPhase), currentPhase);

    yield {
      phase: currentPhase,
      status: "running",
      timestamp: Date.now(),
    };

    // Build agent inputs from accumulated contracts
    const contracts = await loadContracts(projectId);
    const agentInputs = buildAgentInputs(currentPhase, contracts);

    // V2: Get agents based on project complexity
    const phaseAgents = getAgentsForComplexity(currentPhase, complexity as ComplexityClass);
    // Filter out tool agents until Sprint 4
    const agentsToRun = phaseAgents.filter(
      (a) => !["qa_execution", "security_audit", "sre"].includes(a)
    );

    if (agentsToRun.length === 0 && currentPhase === 5) {
      // Phase 5 is all tools — skip for now, mark pending
      yield {
        phase: currentPhase,
        status: "completed",
        timestamp: Date.now(),
        data: { message: "Verification tools not yet implemented" },
      };
      await updateProjectPhase(projectId, currentPhase, "completed");
      const next = getNextPhase(currentPhase);
      if (!next) break;
      currentPhase = next;
      continue;
    }

    // Dispatch all phase agents in parallel (fan-out)
    const { results, failures } = await dispatchPhaseAgents(
      agentsToRun,
      agentInputs,
      projectId,
    );

    // Save successful outputs and emit per-agent updates
    for (const result of results) {
      await savePhaseOutput(projectId, currentPhase, result.agentName, result.output, result.tokensUsed, result.costUsd, result.modelUsed);
      await logAudit(projectId, "agent_call", currentPhase, result);
      yield {
        phase: currentPhase,
        status: "agent_completed",
        agent: result.agentName,
        progress: {
          completed: results.indexOf(result) + 1,
          total: agentsToRun.length,
          failed: failures.length,
        },
        timestamp: Date.now(),
      };
    }

    // Log failures and emit per-agent failure updates
    for (const failure of failures) {
      await logAudit(projectId, "error", currentPhase, {
        agentName: failure.agent,
        output: null,
        modelUsed: "unknown",
        tokensUsed: 0,
        costUsd: 0,
        durationMs: 0,
        error: failure.error,
      });
      yield {
        phase: currentPhase,
        status: "agent_failed",
        agent: failure.agent,
        error: failure.error,
        timestamp: Date.now(),
      };
    }

    // If critical agents failed, pause the project
    if (failures.length > 0 && results.length === 0) {
      await updateProjectPhase(projectId, currentPhase, "failed");
      yield {
        phase: currentPhase,
        status: "failed",
        error: failures.map((f) => `${f.agent}: ${f.error}`).join("; "),
        timestamp: Date.now(),
      };
      return;
    }

    // Save generated files from any phase that produces them (Phase 4, 6)
    const generatedFiles = results.flatMap((r) =>
      Array.isArray(r.output) ? (r.output as GeneratedFile[]) : []
    );
    for (const file of generatedFiles) {
      await saveGeneratedFile(projectId, file, currentPhase, results[0]?.agentName ?? "unknown");
    }

    // Check if human approval is needed
    if (phaseRequiresApproval(currentPhase, complexity)) {
      await updateProjectPhase(projectId, currentPhase, "awaiting_approval");
      yield {
        phase: currentPhase,
        status: "awaiting_approval",
        data: results.map((r) => ({ agent: r.agentName, output: r.output })),
        timestamp: Date.now(),
      };
      // The caller (API route) will handle waiting for approval
      // When approval comes, runProject is called again and resumes from next phase
      return;
    }

    // Phase complete, move to next
    await updateProjectPhase(projectId, currentPhase, "completed");
    yield {
      phase: currentPhase,
      status: "completed",
      data: results.map((r) => ({ agent: r.agentName, output: r.output })),
      timestamp: Date.now(),
    };

    const next = getNextPhase(currentPhase);
    if (!next) break;
    currentPhase = next;
  }

  // All phases done
  await updateProjectStatus(projectId, "live", 6);
  yield {
    phase: 6,
    status: "completed",
    timestamp: Date.now(),
    data: { message: "Build complete" },
  };
}

/** Approve a phase and resume the pipeline */
export async function approvePhase(
  projectId: string,
  phase: number,
  approved: boolean,
  feedback?: string,
): Promise<void> {
  if (!approved) {
    // Revision requested — mark phase for re-run
    await updateProjectPhase(projectId, phase, "pending");
    if (feedback) {
      await logAudit(projectId, "revision_requested", phase, {
        agentName: "human",
        output: { feedback },
        modelUsed: "human",
        tokensUsed: 0,
        costUsd: 0,
        durationMs: 0,
      });
    }
    return;
  }

  // Approve
  await supabase
    .from("phase_outputs")
    .update({ human_approved: true, human_approved_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("phase", phase);

  await updateProjectPhase(projectId, phase, "completed");
  await logAudit(projectId, "human_approval", phase, {
    agentName: "human",
    output: { approved: true },
    modelUsed: "human",
    tokensUsed: 0,
    costUsd: 0,
    durationMs: 0,
  });
}

// --- Internal helpers ---

async function loadProjectState(projectId: string): Promise<ProjectState> {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error(`Project not found: ${projectId}`);

  const { data: outputs } = await supabase
    .from("phase_outputs")
    .select("phase, agent_name, output")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  // Rebuild phase statuses from phase_outputs
  const phases = createInitialPhases();
  const completedPhases = new Set<number>();
  for (const out of outputs ?? []) {
    completedPhases.add(out.phase);
  }
  for (const p of completedPhases) {
    phases[p] = "completed";
  }
  // Override current phase status based on project status
  if (project.status === "paused") {
    phases[project.current_phase] = "awaiting_approval";
  } else if (project.status === "failed") {
    phases[project.current_phase] = "failed";
  }

  // Rebuild contracts from outputs
  const contracts: ProjectState["contracts"] = {};
  for (const out of outputs ?? []) {
    switch (out.agent_name) {
      case "strategist":
        contracts.strategicBrief = out.output;
        break;
      // V2 consolidated agents
      case "product_scope":
        contracts.productSpec = out.output?.productSpec ?? out.output;
        contracts.legalCheck = out.output?.legalCheck;
        break;
      case "tech_architect":
        contracts.techSpec = out.output?.techSpec ?? out.output;
        contracts.securityAnalysis = out.output?.security;
        break;
      case "designer":
        contracts.designSpec = out.output;
        break;
      // Legacy agent names (backward compat with existing DB records)
      case "product_manager":
        contracts.productSpec = out.output;
        break;
      case "legal":
        contracts.legalCheck = out.output;
        break;
      case "architect":
        contracts.techSpec = out.output;
        break;
      case "security_threat":
        contracts.threatModel = out.output;
        break;
    }
  }

  // Load generated files for Phase 5/6 consumption
  const { data: generatedFiles } = await supabase
    .from("generated_files")
    .select("file_path, content, language")
    .eq("project_id", projectId)
    .order("version", { ascending: false });

  if (generatedFiles && generatedFiles.length > 0) {
    // Deduplicate by file_path (latest version first due to ORDER)
    const seen = new Set<string>();
    contracts.files = [];
    for (const f of generatedFiles) {
      if (!seen.has(f.file_path)) {
        seen.add(f.file_path);
        contracts.files.push({
          filePath: f.file_path,
          content: f.content,
          language: f.language,
        });
      }
    }
  }

  return {
    projectId,
    currentPhase: project.current_phase,
    phases,
    contracts,
  };
}

async function loadContracts(projectId: string): Promise<ProjectState["contracts"]> {
  const state = await loadProjectState(projectId);
  return state.contracts;
}

function buildAgentInputs(
  phase: number,
  contracts: ProjectState["contracts"],
): Record<string, unknown> {
  switch (phase) {
    case 2:
      return {
        product_manager: { brief: contracts.strategicBrief },
        legal: { brief: contracts.strategicBrief },
      };
    case 3:
      return {
        architect: { brief: contracts.strategicBrief, productSpec: contracts.productSpec },
        designer: { brief: contracts.strategicBrief, productSpec: contracts.productSpec },
        security_threat: { brief: contracts.strategicBrief, productSpec: contracts.productSpec },
      };
    case 4:
      return {
        backend_engineer: {
          techSpec: contracts.techSpec,
          designSpec: contracts.designSpec,
          productSpec: contracts.productSpec,
          threatModel: contracts.threatModel,
        },
        frontend_engineer: {
          techSpec: contracts.techSpec,
          designSpec: contracts.designSpec,
          productSpec: contracts.productSpec,
        },
        devops: {
          techSpec: contracts.techSpec,
          productSpec: contracts.productSpec,
        },
        qa_writer: {
          productSpec: contracts.productSpec,
          techSpec: contracts.techSpec,
          threatModel: contracts.threatModel,
        },
      };
    case 5:
      return {
        qa_execution: { files: contracts.files },
        security_audit: { files: contracts.files },
        sre: { files: contracts.files },
      };
    case 6:
      return {
        devops_deploy: { files: contracts.files, techSpec: contracts.techSpec },
        marketing: { brief: contracts.strategicBrief, productSpec: contracts.productSpec },
        support_docs: { brief: contracts.strategicBrief, productSpec: contracts.productSpec, techSpec: contracts.techSpec },
      };
    default:
      return {};
  }
}

async function savePhaseOutput(
  projectId: string,
  phase: number,
  agentName: string,
  output: unknown,
  tokensUsed?: number,
  costUsd?: number,
  modelUsed?: string,
): Promise<void> {
  const { createHash } = await import("crypto");
  const outputHash = createHash("sha256")
    .update(JSON.stringify(output))
    .digest("hex")
    .slice(0, 16);

  // Remove previous output for same agent+phase (prevents duplicates on retry)
  await supabase
    .from("phase_outputs")
    .delete()
    .eq("project_id", projectId)
    .eq("phase", phase)
    .eq("agent_name", agentName);

  await supabase.from("phase_outputs").insert({
    project_id: projectId,
    phase,
    agent_name: agentName,
    output,
    tokens_used: tokensUsed ?? null,
    cost_usd: costUsd ?? null,
    model_used: modelUsed ?? null,
    output_hash: outputHash,
  });
}

async function saveGeneratedFile(
  projectId: string,
  file: GeneratedFile,
  phase: number,
  agentName: string,
): Promise<void> {
  const { createHash } = await import("crypto");
  const fileHash = createHash("sha256")
    .update(file.content)
    .digest("hex")
    .slice(0, 16);

  // Get current max version
  const { data: existing } = await supabase
    .from("generated_files")
    .select("version")
    .eq("project_id", projectId)
    .eq("file_path", file.filePath)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

  await supabase.from("generated_files").insert({
    project_id: projectId,
    file_path: file.filePath,
    content: file.content,
    file_hash: fileHash,
    language: file.language,
    phase,
    agent_name: agentName,
    version: nextVersion,
  });
}

async function updateProjectStatus(
  projectId: string,
  status: string,
  currentPhase: number,
): Promise<void> {
  await supabase
    .from("projects")
    .update({ status, current_phase: currentPhase })
    .eq("id", projectId);
}

async function updateProjectPhase(
  projectId: string,
  phase: number,
  status: PhaseStatus,
): Promise<void> {
  if (status === "awaiting_approval") {
    await supabase
      .from("projects")
      .update({ status: "paused", current_phase: phase })
      .eq("id", projectId);
  } else if (status === "completed") {
    const next = getNextPhase(phase);
    await supabase
      .from("projects")
      .update({
        current_phase: next ?? phase,
        status: next ? phaseToProjectStatus(next) : "live",
      })
      .eq("id", projectId);
  } else if (status === "failed") {
    await supabase
      .from("projects")
      .update({ status: "failed", current_phase: phase })
      .eq("id", projectId);
  } else if (status === "pending") {
    await supabase
      .from("projects")
      .update({ status: phaseToProjectStatus(phase), current_phase: phase })
      .eq("id", projectId);
  }
}

async function getProjectComplexity(projectId: string): Promise<ComplexityClass> {
  const { data } = await supabase
    .from("projects")
    .select("complexity_class")
    .eq("id", projectId)
    .single();

  return (data?.complexity_class as ComplexityClass) ?? "standard";
}

async function logAudit(
  projectId: string,
  eventType: string,
  phase: number,
  result: Omit<DispatchResult, "agentName"> & { agentName: string; error?: string },
): Promise<void> {
  const { createHash } = await import("crypto");

  await supabase.from("audit_log").insert({
    project_id: projectId,
    event_type: eventType,
    phase,
    agent_name: result.agentName,
    model_used: result.modelUsed,
    output_hash: result.output
      ? createHash("sha256").update(JSON.stringify(result.output)).digest("hex").slice(0, 16)
      : null,
    confidence: result.confidence,
    duration_ms: result.durationMs,
    tokens_used: result.tokensUsed,
    cost_usd: result.costUsd,
    error_message: result.error ?? null,
  });
}

function inferComplexity(brief: StrategicBrief): ComplexityClass {
  const score = brief.verdict.councilScore;
  // Simple heuristic based on score + feature count in decision agenda
  const decisions = brief.decisionAgenda?.length ?? 0;
  if (decisions <= 2 && score >= 60) return "simple";
  if (decisions <= 5) return "standard";
  if (decisions <= 8) return "complex";
  return "enterprise";
}

function inferRiskLevel(brief: StrategicBrief): string {
  const failReasons = brief.whyThisMayFail?.length ?? 0;
  if (failReasons <= 1) return "low";
  if (failReasons <= 3) return "medium";
  if (failReasons <= 5) return "high";
  return "critical";
}
