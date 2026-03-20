// ============================================================
// Phase 2: Conditional Section Depth
// ============================================================
// Not every mission needs every section at full depth.
// A Haiku triage step classifies the query type, then
// we instruct the Strategist to go deep on relevant sections
// and keep others brief. Saves ~20-30% output tokens.
//
// Implementation: Week 2-3
// Depends on: Haiku utility model integration
// ============================================================

/** How deep a section should be generated */
export type SectionDepth = "detailed" | "standard" | "brief";

/** All brief sections that can have variable depth */
export type BriefSection =
  | "marketAnalysis"
  | "valueProposition"
  | "businessModel"
  | "technicalFeasibility"
  | "riskAssessment"
  | "actionPlan"
  | "decisionAgenda";

/** Query classification from triage step */
export type QueryType =
  | "full_evaluation"
  | "market_question"
  | "pricing_question"
  | "technical_question"
  | "pivot_decision"
  | "follow_up";

/** Depth map per query type — only allocate detail where it matters */
export const SECTION_DEPTH_MAP: Record<QueryType, Record<BriefSection, SectionDepth>> = {
  full_evaluation: {
    marketAnalysis: "detailed",
    valueProposition: "detailed",
    businessModel: "detailed",
    technicalFeasibility: "detailed",
    riskAssessment: "detailed",
    actionPlan: "detailed",
    decisionAgenda: "detailed",
  },
  market_question: {
    marketAnalysis: "detailed",
    valueProposition: "standard",
    businessModel: "standard",
    technicalFeasibility: "brief",
    riskAssessment: "standard",
    actionPlan: "brief",
    decisionAgenda: "detailed",
  },
  pricing_question: {
    marketAnalysis: "standard",
    valueProposition: "standard",
    businessModel: "detailed",
    technicalFeasibility: "brief",
    riskAssessment: "standard",
    actionPlan: "brief",
    decisionAgenda: "detailed",
  },
  technical_question: {
    marketAnalysis: "brief",
    valueProposition: "standard",
    businessModel: "brief",
    technicalFeasibility: "detailed",
    riskAssessment: "detailed",
    actionPlan: "detailed",
    decisionAgenda: "detailed",
  },
  pivot_decision: {
    marketAnalysis: "detailed",
    valueProposition: "detailed",
    businessModel: "standard",
    technicalFeasibility: "brief",
    riskAssessment: "detailed",
    actionPlan: "standard",
    decisionAgenda: "detailed",
  },
  follow_up: {
    marketAnalysis: "brief",
    valueProposition: "brief",
    businessModel: "brief",
    technicalFeasibility: "brief",
    riskAssessment: "brief",
    actionPlan: "standard",
    decisionAgenda: "detailed",
  },
};

/**
 * Generate a section depth instruction to append to the strategist prompt.
 * This tells the model which sections to expand and which to keep concise.
 */
export function buildDepthInstruction(
  depthMap: Record<BriefSection, SectionDepth>
): string {
  const lines = Object.entries(depthMap).map(([section, depth]) => {
    const label =
      depth === "detailed"
        ? "Write in full depth with specifics"
        : depth === "brief"
          ? "Keep concise (2-3 sentences max)"
          : "Standard depth";
    return `- ${section}: ${label}`;
  });

  return `\n## SECTION DEPTH GUIDE\n${lines.join("\n")}\n`;
}
