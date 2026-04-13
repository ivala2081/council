import { supabase } from "@/lib/supabase-server";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
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
