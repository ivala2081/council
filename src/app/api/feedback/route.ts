import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();

  const { missionId, ...scores } = body;

  if (!missionId) {
    return Response.json({ error: "missionId required" }, { status: 400 });
  }

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
