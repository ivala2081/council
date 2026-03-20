import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FeedbackSchema = z.object({
  missionId: z.string().uuid(),
  overall_score: z.number().int().min(1).max(5),
  specificity_score: z.number().int().min(1).max(5).nullable().optional(),
  actionability_score: z.number().int().min(1).max(5).nullable().optional(),
  depth_score: z.number().int().min(1).max(5).nullable().optional(),
  accuracy_score: z.number().int().min(1).max(5).nullable().optional(),
  decision_clarity_score: z.number().int().min(1).max(5).nullable().optional(),
  free_text: z.string().max(2000).nullable().optional(),
  would_pay: z.boolean().nullable().optional(),
  would_use_again: z.boolean().nullable().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid feedback data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { missionId, ...scores } = parsed.data;

  const { error } = await supabase.from("feedback").insert({
    mission_id: missionId,
    overall_score: scores.overall_score,
    specificity_score: scores.specificity_score,
    actionability_score: scores.actionability_score,
    depth_score: scores.depth_score,
    accuracy_score: scores.accuracy_score,
    decision_clarity_score: scores.decision_clarity_score,
    free_text: scores.free_text,
    would_pay: scores.would_pay,
    would_use_again: scores.would_use_again,
  });

  if (error) {
    console.error("[feedback] DB error:", error);
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
