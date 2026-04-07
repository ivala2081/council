/**
 * Conversation engine for the Socratic intake system.
 * Detects power users, manages conversation state, and compiles
 * structured context for the Strategist agent.
 */

export interface ConversationMessage {
  role: "council" | "user";
  content: string;
}

export interface IntakeContext {
  target_user: string;
  problem: string;
  vision: string;
  team: string;
  traction: string;
  differentiator: string;
  raw_conversation: ConversationMessage[];
}

const POWER_USER_SIGNALS = [
  /\b(team|co-?founder|engineer|developer|designer)\b/i,
  /\b(problem|pain\s?point|challenge|friction)\b/i,
  /\b(user|customer|audience|target|segment)\b/i,
  /\b(revenue|traction|growth|mau|dau|arr|mrr|\d+k?\s*(users?|customers?))\b/i,
  /\b(compet|alternative|existing\s*solution|market)\b/i,
];

export function isPowerUser(firstMessage: string): boolean {
  const matchCount = POWER_USER_SIGNALS.filter((pattern) =>
    pattern.test(firstMessage)
  ).length;
  return matchCount >= 3;
}

export const INTAKE_SYSTEM_PROMPT = `You are Council, a strategic co-founder. You help founders think clearly about their ideas through conversation. You ask questions — you don't lecture.

Rules:
- Ask ONE question at a time. Never ask two questions in one message.
- Match the user's language (Turkish → Turkish, English → English).
- If the user provides comprehensive input (team, problem, target, traction), acknowledge it and ask ONE deepening question, then proceed to reflection.
- Never use emojis. Be warm but professional.
- Keep responses under 2 sentences.
- After gathering enough information, provide a structured reflection and ask for confirmation.

You have enough info when you know:
1. Who the target user is
2. What problem they face
3. What the solution looks like
4. Who is building it

Traction and differentiation are bonuses — don't block on them.

IMPORTANT: When you have enough information, respond with a reflection in this exact format:
[REFLECTION]
Target: <who benefits>
Problem: <core problem>
Vision: <ideal future state>
Team: <who is building>
Traction: <what has been done so far, or "Not mentioned">
[/REFLECTION]
Is this right? / Doğru mu?`;

export function buildIntakePrompt(
  messages: ConversationMessage[],
  isPower: boolean
): string {
  if (messages.length === 0) return INTAKE_SYSTEM_PROMPT;

  let extraInstruction = "";
  if (isPower && messages.filter((m) => m.role === "user").length === 1) {
    extraInstruction =
      "\n\nThe user provided comprehensive input. Acknowledge it briefly, ask ONE deepening question, then provide your [REFLECTION] in your next response.";
  }

  return INTAKE_SYSTEM_PROMPT + extraInstruction;
}

export function parseReflection(text: string): IntakeContext | null {
  // Support truncated reflections (missing closing tag)
  const match = text.match(/\[REFLECTION\]([\s\S]*?)(?:\[\/REFLECTION\]|$)/);
  const fallback = !match ? text.match(/(Target:.+[\s\S]*)/m) : null;
  if (!match && !fallback) return null;

  const block = match?.[1] ?? fallback?.[1] ?? "";
  const get = (key: string) => {
    const m = block.match(new RegExp(`${key}:\\s*(.+)`, "i"));
    return m?.[1]?.trim() ?? "";
  };

  return {
    target_user: get("Target"),
    problem: get("Problem"),
    vision: get("Vision"),
    team: get("Team"),
    traction: get("Traction") || "Not mentioned",
    differentiator: "",
    raw_conversation: [],
  };
}

export function isReflection(text: string): boolean {
  // Accept reflection even if closing tag was truncated
  return text.includes("[REFLECTION]") || /^Target:.+\nProblem:.+/m.test(text);
}
