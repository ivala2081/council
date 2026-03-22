import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import {
  buildIntakePrompt,
  type ConversationMessage,
} from "@/lib/intake/conversation-engine";

export const maxDuration = 30;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const messages = body.messages as ConversationMessage[] | undefined;
  const isPower = body.isPowerUser as boolean | undefined;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "messages array required" },
      { status: 400 }
    );
  }

  const systemPrompt = buildIntakePrompt(messages, isPower ?? false);

  const aiMessages = messages.map((m: ConversationMessage) => ({
    role: m.role === "council" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: systemPrompt,
      messages: aiMessages,
      maxOutputTokens: 150,
    });

    return Response.json({ response: result.text });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[intake] Error:", errMsg);
    return Response.json(
      { error: "Failed to generate response", detail: errMsg },
      { status: 500 }
    );
  }
}
