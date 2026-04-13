// ============================================================
// CEO Agent — Hybrid Router (Code classifier + Haiku fallback)
// V2: User's single point of contact, routes to departments
// ============================================================

export const CEO_SYSTEM_PROMPT = `You are the CEO of Council, an AI-powered software company. You are the user's single point of contact.

## YOUR PERSONALITY
- Professional but warm. Approachable for all ages and technical levels.
- Confident but not arrogant. You lead a team, not lecture.
- Concise — 2-3 sentences max per response unless the user asks for detail.
- Speak the user's language (Turkish if they write in Turkish, English otherwise).

## YOUR ROLE
- Greet users and understand what they want to build.
- Explain what your team (departments) will do, in simple terms.
- Share project status updates when asked.
- Ask for approval at key decision points.
- Never expose technical details (model names, token counts, costs).

## WHAT YOU KNOW
You receive a compact project state summary. Use it to answer status questions.
Do NOT make up information. If you don't know, say "Let me check with the team."

## RESPONSE FORMAT
Respond with valid JSON:
{
  "message": "Your response to the user",
  "intent": "greeting" | "status_update" | "recommendation" | "clarification" | "approval_prompt",
  "suggestedActions": ["optional", "action", "buttons"]
}`;

// ============================================================
// Intent Classifier — Zero-cost code-based routing
// ============================================================

export type CeoIntent =
  | "start_project"    // "projeyi başlat", "build this", "yap"
  | "check_status"     // "durum ne", "nasıl gidiyor", "status"
  | "approve"          // "onayla", "approve", "evet", "devam"
  | "reject"           // "reddet", "hayır", "değiştir"
  | "list_projects"    // "projelerim", "my projects"
  | "new_idea"         // "yeni fikir", "new idea"
  | "conversational";  // Everything else → Haiku fallback

interface IntentPattern {
  intent: CeoIntent;
  patterns: RegExp[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "start_project",
    patterns: [
      /\b(başlat|start|build|yap|inşa|oluştur|create|kur)\b/i,
      /\b(projeyi|pipeline|deploy)\s*(başlat|run|çalıştır)\b/i,
    ],
  },
  {
    intent: "check_status",
    patterns: [
      /\b(durum|status|nasıl|gidiyor|progress|ilerleme|ne\s*aşamada)\b/i,
      /\b(hangi\s*aşama|which\s*phase|current\s*phase)\b/i,
    ],
  },
  {
    intent: "approve",
    patterns: [
      /\b(onayla|approve|evet|yes|devam|continue|tamam|ok|kabul|confirm)\b/i,
      /^(evet|yes|ok|tamam|devam)$/i,
    ],
  },
  {
    intent: "reject",
    patterns: [
      /\b(reddet|reject|hayır|no|değiştir|change|düzelt|revise)\b/i,
    ],
  },
  {
    intent: "list_projects",
    patterns: [
      /\b(projelerim|projects|listele|list|göster)\b/i,
    ],
  },
  {
    intent: "new_idea",
    patterns: [
      /\byeni\s*(bir\s*)?(fikir|fikrim|proje|projem|idea)\b/i,
      /\bnew\s*(idea|project)\b/i,
    ],
  },
];

/**
 * Classify user message intent — zero cost, pure code.
 * Returns "conversational" for anything that doesn't match → triggers Haiku.
 */
export function classifyIntent(message: string): CeoIntent {
  const trimmed = message.trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return intent;
      }
    }
  }
  return "conversational";
}

/**
 * Check if this intent needs an LLM call or can be handled deterministically.
 */
export function isDeterministicIntent(intent: CeoIntent): boolean {
  return intent !== "conversational";
}

/**
 * Compress project state into ~300 tokens for CEO context injection.
 */
export function compressProjectState(state: {
  projectId: string;
  name: string;
  status: string;
  currentPhase: number;
  complexity: string;
  verdict?: string;
  score?: number;
}): string {
  const phaseNames: Record<number, string> = {
    1: "Strategic Analysis",
    2: "Product Definition",
    3: "Architecture & Design",
    4: "Implementation",
    5: "Verification",
    6: "Release",
  };
  const currentPhaseName = phaseNames[state.currentPhase] ?? "Unknown";

  return [
    `Project: ${state.name} (${state.projectId})`,
    `Status: ${state.status} | Phase: ${state.currentPhase}/6 (${currentPhaseName})`,
    `Complexity: ${state.complexity}`,
    state.verdict ? `Verdict: ${state.verdict} (Score: ${state.score}/100)` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
