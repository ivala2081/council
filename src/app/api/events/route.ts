import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  const {
    event,
    owner_token,
    thread_id,
    mission_id,
    run_number,
    verdict,
    score,
    score_delta,
    metadata,
  } = body;

  if (!event) {
    return Response.json({ error: "event required" }, { status: 400 });
  }

  const { error } = await supabase.from("events").insert({
    event_name: event,
    owner_token: owner_token || null,
    thread_id: thread_id || null,
    mission_id: mission_id || null,
    run_number: run_number ?? null,
    verdict: verdict || null,
    score: score ?? null,
    score_delta: score_delta ?? null,
    metadata: metadata || {},
  });

  if (error) {
    console.error("[events] DB error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
