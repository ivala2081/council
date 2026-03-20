// ============================================================
// Phase 2: Zero-Cost Query Classification
// ============================================================
// Classifies founder prompts by type using keyword matching.
// No API call needed — instant, free classification.
// Used for adaptive token budgets and section depth hints.
// ============================================================

import type { QueryType, BriefSection, SectionDepth } from "./section-depth";
import { SECTION_DEPTH_MAP, buildDepthInstruction } from "./section-depth";

interface ClassificationResult {
  queryType: QueryType;
  confidence: "high" | "medium" | "low";
  depthMap: Record<BriefSection, SectionDepth>;
  depthInstruction: string | null;
}

// Keyword patterns for each query type (supports EN + TR)
const QUERY_PATTERNS: { type: QueryType; patterns: RegExp[] }[] = [
  {
    type: "pricing_question",
    patterns: [
      /\b(pric|fiyat|ücret|pricing model|revenue model|subscription|freemium|monetiz|unit economics|arpu|ltv|cac)\b/i,
    ],
  },
  {
    type: "technical_question",
    patterns: [
      /\b(tech stack|architecture|infrastructure|scalab|database|api design|microservice|devops|teknik|altyapı|teknoloji seçimi)\b/i,
    ],
  },
  {
    type: "market_question",
    patterns: [
      /\b(market size|tam |competitor|rakip|pazar|market research|market analysis|segmentation|target audience|hedef kitle)\b/i,
    ],
  },
  {
    type: "pivot_decision",
    patterns: [
      /\b(pivot|change direction|yön değiştir|should (i|we) (switch|change|pivot)|reposition|rebrand)\b/i,
    ],
  },
  {
    type: "follow_up",
    patterns: [
      /\b(follow.?up|update|devam|güncelle|previous brief|last time|earlier you said|daha önce)\b/i,
    ],
  },
];

/**
 * Classify a founder's prompt into a query type using keyword matching.
 * Returns full_evaluation as default (safest — no quality impact).
 */
export function classifyQuery(prompt: string): ClassificationResult {
  const lower = prompt.toLowerCase();

  // Short prompts are almost always full evaluations
  if (prompt.length < 100) {
    return {
      queryType: "full_evaluation",
      confidence: "high",
      depthMap: SECTION_DEPTH_MAP.full_evaluation,
      depthInstruction: null,
    };
  }

  // Check for specific query patterns
  for (const { type, patterns } of QUERY_PATTERNS) {
    const matches = patterns.filter((p) => p.test(lower));
    if (matches.length > 0) {
      // If prompt is long (>300 chars) and mentions specific topic,
      // it's likely a full eval with emphasis, not a focused query
      if (prompt.length > 300) {
        return {
          queryType: "full_evaluation",
          confidence: "medium",
          depthMap: SECTION_DEPTH_MAP.full_evaluation,
          depthInstruction: null,
        };
      }

      const depthMap = SECTION_DEPTH_MAP[type];
      return {
        queryType: type,
        confidence: "medium",
        depthMap,
        depthInstruction: buildDepthInstruction(depthMap),
      };
    }
  }

  // Default: full evaluation (no depth modification)
  return {
    queryType: "full_evaluation",
    confidence: "high",
    depthMap: SECTION_DEPTH_MAP.full_evaluation,
    depthInstruction: null,
  };
}

/**
 * Build an enriched user message with optional depth hints.
 * Depth hints are appended AFTER the user's prompt so
 * the system prompt (v5.5-final) remains untouched.
 */
export function buildEnrichedPrompt(
  userPrompt: string,
  classification: ClassificationResult,
  previousContext?: string | null
): string {
  const parts: string[] = [];

  // Previous brief context for returning companies
  if (previousContext) {
    parts.push(previousContext);
    parts.push("---");
  }

  // Original user prompt (always first/primary)
  parts.push(userPrompt);

  // Depth hints (only for non-full queries)
  if (classification.depthInstruction) {
    parts.push(classification.depthInstruction);
  }

  return parts.join("\n\n");
}
