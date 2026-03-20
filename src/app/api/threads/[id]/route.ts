import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/threads/[id]
 * Fetch a single thread with all its runs (missions).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [threadRes, runsRes] = await Promise.all([
    supabase
      .from("threads")
      .select("id, name, latest_verdict, latest_score, run_count, created_at, updated_at")
      .eq("id", id)
      .single(),
    supabase
      .from("missions")
      .select("id, prompt, status, result, delta, run_number, pipeline_mode, created_at, completed_at")
      .eq("thread_id", id)
      .order("run_number", { ascending: true }),
  ]);

  if (threadRes.error || !threadRes.data) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({
    thread: threadRes.data,
    runs: runsRes.data ?? [],
  });
}
