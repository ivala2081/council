// Council Optimization Module
// See OPTIMIZATION_ROADMAP.md for implementation timeline

// Phase 1 (Active)
export {
  MODEL_TIERS,
  ANTHROPIC_PRICING,
  TOKEN_BUDGETS,
  ADAPTIVE_TOKEN_BUDGETS,
  DEFAULT_MODEL,
  calculateCostUsd,
  formatUsageLog,
  type ModelTier,
  type ModelId,
} from "./config";

// Phase 2: Query Classification + Section Depth
export {
  classifyQuery,
  buildEnrichedPrompt,
} from "./query-classifier";

export {
  SECTION_DEPTH_MAP,
  buildDepthInstruction,
  type QueryType,
  type SectionDepth,
  type BriefSection,
} from "./section-depth";

// Phase 2: Confidence-Driven Escalation (infrastructure ready)
export {
  detectEscalationNeeded,
  selectModelForSection,
  type EscalationSignal,
} from "./escalation";

// Phase 3: Incremental Brief Updates
export {
  buildIncrementalContext,
} from "./incremental";

// Phase 4: Memory Compaction
export {
  getCompactedMemory,
  getPreviousBrief,
} from "./memory";
