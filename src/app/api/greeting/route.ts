import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export const maxDuration = 10;

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

  const threads = body.threads as Array<{
    name: string;
    latest_verdict: string | null;
    latest_score: number | null;
    run_count: number;
    updated_at: string;
  }>;

  if (!threads || !Array.isArray(threads) || threads.length === 0) {
    return Response.json({ greeting: null });
  }

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: `You are Council, a strategic co-founder. Generate a 1-2 sentence greeting for a returning user. Reference their most relevant thread based on recency and status. Ask one question that drives action. Match the user's language based on their thread names (Turkish names → Turkish greeting, English names → English). Be warm but concise. Never use emojis.`,
      messages: [
        {
          role: "user",
          content: `User's threads:\n${JSON.stringify(threads.slice(0, 5), null, 2)}\n\nCurrent time: ${new Date().toISOString()}`,
        },
      ],
      maxOutputTokens: 80,
    });

    return Response.json({ greeting: result.text });
  } catch (error) {
    console.error("[greeting] Error:", error);
    return Response.json({ greeting: null });
  }
}
