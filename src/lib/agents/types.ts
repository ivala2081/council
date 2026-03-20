import { z } from "zod";

// --- Enums ---
export const verdictSchema = z.enum(["strong", "promising", "risky", "weak"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);
export const severitySchema = z.enum(["critical", "high", "medium", "low"]);
export const prioritySchema = z.enum(["critical", "important", "consider"]);
export const confidenceTagSchema = z.enum(["verified", "estimated", "speculative"]);
export const riskCategorySchema = z.enum([
  "market",
  "technical",
  "financial",
  "regulatory",
  "competitive",
  "execution",
]);

// --- v5.1 Penalty Schema ---
export const penaltyIdSchema = z.enum(["capitalInsufficient", "founderMarketMismatch", "noDistribution"]);
export const penaltySchema = z.object({
  id: penaltyIdSchema,
  applied: z.boolean(),
  reason: z.string(),
});

// --- Strategic Brief v5 Schema ---
export const strategicBriefSchema = z.object({
  verdict: z.object({
    verdict: verdictSchema,
    summary: z.string(),
    councilScore: z.number().min(0).max(100),
    baseScore: z.number().min(0).max(100),
    penalties: z.array(penaltySchema),
    verdictReasoning: z.string(),
    scoreBreakdown: z.object({
      team: z.number().min(0).max(20),
      market: z.number().min(0).max(20),
      traction: z.number().min(0).max(20),
      defensibility: z.number().min(0).max(20),
      timing: z.number().min(0).max(20),
    }),
  }),

  decisionAgenda: z.array(
    z.object({
      priority: prioritySchema,
      question: z.string(),
      options: z.array(
        z.object({
          option: z.string(),
          tradeoff: z.string(),
        })
      ),
      recommendation: z.string(),
      evidence: z.string().optional(),
      secondOrderEffects: z.string().optional(),
      deadline: z.string(),
    })
  ),

  whyThisMayWork: z.array(z.string()),
  whyThisMayFail: z.array(z.string()),

  whatMustBeTrue: z.array(z.string()),

  market: z.object({
    tam: z.string(),
    buyerProfile: z.string(),
    competitors: z.array(
      z.object({
        name: z.string(),
        whyTheyWin: z.string(),
        whyYouCouldBeatThem: z.string(),
        confidence: confidenceTagSchema,
      })
    ),
    positioning: z.string(),
  }),

  founderFit: z.object({
    strengths: z.array(z.string()),
    gaps: z.array(z.string()),
    recommendation: z.string(),
  }),

  validationSprint: z.array(
    z.object({
      day: z.string(),
      task: z.string(),
      successCriteria: z.string(),
    })
  ),

  criticalTechnicalDecision: z.object({
    question: z.string(),
    recommendation: z.string(),
    rationale: z.string(),
  }),

  assumptionLedger: z.array(
    z.object({
      assumption: z.string(),
      confidence: confidenceTagSchema,
      howToValidate: z.string(),
    })
  ),

  metadata: z.object({
    pipelineMode: z.enum(["single", "dual", "full", "concise"]),
    agentsUsed: z.array(z.string()),
    totalTokens: z.number(),
    totalCostUsd: z.number(),
    durationMs: z.number(),
    language: z.string(),
  }),
});

export type StrategicBrief = z.infer<typeof strategicBriefSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type ConfidenceTag = z.infer<typeof confidenceTagSchema>;

// --- Concise Brief Schema (Verdict + Decisions + What Must Be True) ---
export const conciseBriefSchema = z.object({
  verdict: z.object({
    verdict: verdictSchema,
    summary: z.string(),
    councilScore: z.number().min(0).max(100),
    baseScore: z.number().min(0).max(100),
    penalties: z.array(penaltySchema),
    verdictReasoning: z.string(),
    scoreBreakdown: z.object({
      team: z.number().min(0).max(20),
      market: z.number().min(0).max(20),
      traction: z.number().min(0).max(20),
      defensibility: z.number().min(0).max(20),
      timing: z.number().min(0).max(20),
    }),
  }),

  decisionAgenda: z.array(
    z.object({
      priority: prioritySchema,
      question: z.string(),
      options: z.array(
        z.object({
          option: z.string(),
          tradeoff: z.string(),
        })
      ),
      recommendation: z.string(),
      evidence: z.string().optional(),
      secondOrderEffects: z.string().optional(),
      deadline: z.string(),
    })
  ),

  whatMustBeTrue: z.array(z.string()),

  whyThisMayFail: z.array(z.string()),

  metadata: z.object({
    pipelineMode: z.enum(["single", "dual", "full", "concise"]),
    agentsUsed: z.array(z.string()),
    totalTokens: z.number(),
    totalCostUsd: z.number(),
    durationMs: z.number(),
    language: z.string(),
  }),
});

export type ConciseBrief = z.infer<typeof conciseBriefSchema>;

// ============================================================
// AiCompanyOS — Phase Contract Schemas
// ============================================================

// --- Project Status ---
export const projectStatusSchema = z.enum([
  "intake", "product", "design", "building", "verifying", "releasing", "live", "paused", "failed",
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const complexityClassSchema = z.enum(["simple", "standard", "complex", "enterprise"]);
export type ComplexityClass = z.infer<typeof complexityClassSchema>;

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

// --- Phase 2: ProductSpec ---
export const productSpecSchema = z.object({
  features: z.array(z.object({
    name: z.string(),
    description: z.string(),
    priority: z.enum(["must", "should", "could"]),
    userStories: z.array(z.string()),
    acceptanceCriteria: z.array(z.string()),
  })),
  pages: z.array(z.object({
    name: z.string(),
    path: z.string(),
    description: z.string(),
    role: z.string(),
  })),
  roles: z.array(z.object({
    name: z.string(),
    permissions: z.array(z.string()),
  })),
  constraints: z.array(z.string()),
  outOfScope: z.array(z.string()),
});
export type ProductSpec = z.infer<typeof productSpecSchema>;

// --- Phase 2: LegalCheck ---
export const legalCheckSchema = z.object({
  dataPrivacy: z.object({
    gdprApplicable: z.boolean(),
    kvkkApplicable: z.boolean(),
    dataTypes: z.array(z.string()),
    consentRequired: z.boolean(),
    dpaRequired: z.boolean(),
  }),
  regulations: z.array(z.object({
    regulation: z.string(),
    applicable: z.boolean(),
    impact: z.string(),
    action: z.string(),
  })),
  licenses: z.array(z.object({
    dependency: z.string(),
    license: z.string(),
    compatible: z.boolean().nullable().default(true),
  })),
  riskFlags: z.array(z.string()),
  recommendation: z.string(),
});
export type LegalCheck = z.infer<typeof legalCheckSchema>;

// --- Phase 3: TechSpec ---
export const techSpecSchema = z.object({
  stack: z.object({
    framework: z.string(),
    database: z.string(),
    auth: z.string(),
    payments: z.string().optional(),
    hosting: z.string(),
  }),
  apiContracts: z.array(z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string(),
    description: z.string(),
    requestBody: z.string().optional(),
    responseBody: z.string(),
    auth: z.boolean(),
  })),
  dbSchema: z.object({
    tables: z.array(z.object({
      name: z.string(),
      columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean(),
        isPrimaryKey: z.boolean().optional(),
        isForeignKey: z.boolean().optional(),
        references: z.string().optional(),
      })),
      indexes: z.array(z.string()).optional(),
      rls: z.boolean().default(true),
    })),
    migration: z.string(),
  }),
  envVars: z.array(z.object({
    name: z.string(),
    description: z.string(),
    required: z.boolean(),
    example: z.string(),
  })),
});
export type TechSpec = z.infer<typeof techSpecSchema>;

// --- Phase 3: DesignSpec ---
export const designSpecSchema = z.object({
  tokens: z.object({
    colors: z.record(z.string(), z.string()),
    spacing: z.record(z.string(), z.string()),
    borderRadius: z.record(z.string(), z.string()),
    fonts: z.record(z.string(), z.string()),
  }),
  pages: z.array(z.object({
    name: z.string(),
    path: z.string(),
    componentCode: z.string(),
    description: z.string(),
  })),
  sharedComponents: z.array(z.object({
    name: z.string(),
    code: z.string(),
    props: z.string(),
  })),
  layout: z.object({
    code: z.string(),
    navigation: z.string(),
  }),
});
export type DesignSpec = z.infer<typeof designSpecSchema>;

// --- Phase 3: ThreatModel ---
export const threatModelSchema = z.object({
  attackSurface: z.array(z.object({
    entry: z.string(),
    threat: z.string(),
    strideCategory: z.enum(["spoofing", "tampering", "repudiation", "information_disclosure", "denial_of_service", "elevation_of_privilege"]),
    severity: severitySchema,
    mitigation: z.string(),
  })),
  authDesign: z.object({
    method: z.string(),
    mfaRequired: z.boolean(),
    sessionStrategy: z.string(),
    rlsPolicies: z.array(z.string()),
  }),
  dataFlow: z.array(z.object({
    from: z.string(),
    to: z.string(),
    data: z.string(),
    encrypted: z.boolean(),
    sensitive: z.boolean(),
  })),
  recommendations: z.array(z.string()),
});
export type ThreatModel = z.infer<typeof threatModelSchema>;

// --- Phase 4: GeneratedFile ---
export const generatedFileSchema = z.object({
  filePath: z
    .string()
    .min(1, "File path cannot be empty")
    .refine((p) => !p.includes("\\"), "Use forward slashes, not backslashes")
    .refine((p) => !p.startsWith("/"), "Use relative paths, not absolute")
    .refine((p) => !p.includes(".."), "Path traversal not allowed"),
  content: z.string().min(1, "File content cannot be empty"),
  language: z.enum([
    "typescript",
    "javascript",
    "tsx",
    "jsx",
    "css",
    "sql",
    "json",
    "yaml",
    "text",
    "markdown",
  ]),
});
export type GeneratedFile = z.infer<typeof generatedFileSchema>;

// --- Phase 5: VerificationReport ---
export const verificationReportSchema = z.object({
  tests: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    coverage: z.number(),
  }),
  security: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    findings: z.array(z.object({
      severity: z.string(),
      rule: z.string(),
      file: z.string(),
      line: z.number(),
      message: z.string(),
    })),
  }),
  performance: z.object({
    lighthouseScore: z.number(),
    lcp: z.number(),
    fid: z.number(),
    cls: z.number(),
  }),
  gates: z.object({
    testsPass: z.boolean(),
    securityPass: z.boolean(),
    performancePass: z.boolean(),
    overallPass: z.boolean(),
  }),
});
export type VerificationReport = z.infer<typeof verificationReportSchema>;

// --- Phase 6: DeploymentResult ---
export const deploymentResultSchema = z.object({
  githubUrl: z.string().optional().default(""),
  deployUrl: z.string().optional().default(""),
  branch: z.string().optional().default("main"),
  commitSha: z.string().optional().default(""),
  envVarsSet: z.array(z.string()).optional().default([]),
  migrationApplied: z.boolean().optional().default(false),
  migrationRequired: z.boolean().optional(),
  migrationFilePath: z.string().optional(),
});
export type DeploymentResult = z.infer<typeof deploymentResultSchema>;

// --- Orchestrator Types ---
export const phaseStatusSchema = z.enum(["pending", "running", "awaiting_approval", "completed", "failed", "skipped", "agent_completed", "agent_failed"]);
export type PhaseStatus = z.infer<typeof phaseStatusSchema>;

export interface PhaseUpdate {
  phase: number;
  status: PhaseStatus;
  agent?: string;
  agentName?: string;
  progress?: { completed: number; total: number; failed: number };
  data?: unknown;
  files?: GeneratedFile[];
  error?: string;
  timestamp: number;
}

export interface ProjectState {
  projectId: string;
  currentPhase: number;
  phases: Record<number, PhaseStatus>;
  contracts: {
    strategicBrief?: StrategicBrief;
    productSpec?: ProductSpec;
    legalCheck?: LegalCheck;
    techSpec?: TechSpec;
    designSpec?: DesignSpec;
    threatModel?: ThreatModel;
    files?: GeneratedFile[];
    verificationReport?: VerificationReport;
    deploymentResult?: DeploymentResult;
  };
}

export type AgentName =
  | "strategist"
  | "product_manager"
  | "legal"
  | "architect"
  | "designer"
  | "security_threat"
  | "backend_engineer"
  | "frontend_engineer"
  | "devops"
  | "qa_writer"
  | "qa_execution"
  | "security_audit"
  | "sre"
  | "verification"
  | "devops_deploy"
  | "marketing"
  | "support_docs";

export type ModelTier = "haiku" | "sonnet" | "deepseek" | "tool";

export interface AgentDefinition {
  name: AgentName;
  phase: number;
  modelTier: ModelTier;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  systemPrompt: string;
}
