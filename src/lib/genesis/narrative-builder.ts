/**
 * Transforms raw agent outputs into human-readable narrative entries.
 * Rule-based extraction — zero LLM cost.
 */

export interface NarrativeEntry {
  agent: string;
  headline: string;
  reasoning: string;
  artifacts: string[];
}

export interface Chapter {
  number: number;
  name: string;
  phase: number;
  status: "completed" | "running" | "pending" | "failed" | "skipped";
  narratives: NarrativeEntry[];
  error?: string;
}

const CHAPTER_MAP: Record<number, { number: number; name: string }> = {
  1: { number: 1, name: "Strategy" },
  2: { number: 2, name: "Product Definition" },
  3: { number: 3, name: "Architecture" },
  4: { number: 4, name: "Build" },
  5: { number: 5, name: "Verify" },
  6: { number: 6, name: "Launch" },
};

export function buildNarrative(
  agent: string,
  output: Record<string, unknown>
): NarrativeEntry {
  const reasoning =
    (output.reasoning as string) ??
    (output.rationale as string) ??
    (output.summary as string) ??
    "";

  const headline = extractHeadline(agent, output);
  const artifacts = extractArtifacts(output);

  return { agent, headline, reasoning, artifacts };
}

function extractHeadline(
  agent: string,
  output: Record<string, unknown>
): string {
  if (output.headline) return output.headline as string;

  const agentLabels: Record<string, string> = {
    "product-manager": "Defined product requirements",
    legal: "Assessed legal risks",
    architect: "Designed system architecture",
    designer: "Created design system",
    security: "Completed security audit",
    "backend-engineer": "Built backend services",
    "frontend-engineer": "Built frontend application",
    devops: "Set up infrastructure",
    "qa-writer": "Wrote test suites",
    "devops-deploy": "Prepared deployment",
    marketing: "Created launch materials",
    "support-docs": "Wrote documentation",
  };

  return agentLabels[agent] ?? `${agent} completed their work`;
}

function extractArtifacts(output: Record<string, unknown>): string[] {
  if (Array.isArray(output.files)) {
    return (output.files as Array<{ path?: string }>)
      .map((f) => f.path ?? "")
      .filter(Boolean);
  }
  if (Array.isArray(output.artifacts)) {
    return output.artifacts as string[];
  }
  return [];
}

export function buildChapters(
  currentPhase: number,
  phaseOutputs: Array<{
    phase: number;
    agent_name: string;
    output: Record<string, unknown>;
  }>,
  status: string
): Chapter[] {
  return Object.entries(CHAPTER_MAP).map(([phaseNum, meta]) => {
    const phase = parseInt(phaseNum);
    const outputs = phaseOutputs.filter((o) => o.phase === phase);

    let chapterStatus: Chapter["status"] = "pending";
    if (phase < currentPhase) {
      chapterStatus = outputs.length > 0 ? "completed" : "skipped";
    } else if (phase === currentPhase) {
      chapterStatus = status === "failed" ? "failed" : "running";
    }

    const narratives = outputs.map((o) =>
      buildNarrative(o.agent_name, o.output)
    );

    return {
      ...meta,
      phase,
      status: chapterStatus,
      narratives,
    };
  });
}
