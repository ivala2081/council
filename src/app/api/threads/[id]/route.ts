import { supabase } from "@/lib/supabase-server";

/**
 * GET /api/threads/[id]?token=xxx
 * Fetch a single thread with all its runs (missions).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [threadRes, runsRes] = await Promise.all([
    supabase
      .from("threads")
      .select("id, name, owner_token, latest_verdict, latest_score, run_count, created_at, updated_at")
      .eq("id", id)
      .single(),
    supabase
      .from("missions")
      .select("id, prompt, status, result, delta, run_number, pipeline_mode, created_at, completed_at")
      .eq("thread_id", id)
      .order("run_number", { ascending: true }),
  ]);

  if (threadRes.error || !threadRes.data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (threadRes.data.owner_token !== token) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { owner_token: _, ...thread } = threadRes.data;

  return Response.json({
    thread,
    runs: runsRes.data ?? [],
  });
}
