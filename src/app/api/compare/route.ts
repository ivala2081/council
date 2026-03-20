import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/compare?a=threadId&b=threadId&token=xxx
 * Fetch two threads with their latest completed run for comparison.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const aId = searchParams.get("a");
  const bId = searchParams.get("b");
  const token = searchParams.get("token");

  if (!aId || !bId) {
    return Response.json({ error: "Both thread IDs required" }, { status: 400 });
  }

  if (!token) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  async function getThreadWithLatestRun(threadId: string) {
    const [threadRes, runRes] = await Promise.all([
      supabase
        .from("threads")
        .select("id, name, owner_token, latest_verdict, latest_score, run_count, created_at")
        .eq("id", threadId)
        .single(),
      supabase
        .from("missions")
        .select("id, prompt, result, run_number, created_at")
        .eq("thread_id", threadId)
        .eq("status", "completed")
        .order("run_number", { ascending: false })
        .limit(1),
    ]);

    if (threadRes.error || !threadRes.data) return null;

    if (threadRes.data.owner_token !== token) return null;

    const { owner_token: _, ...thread } = threadRes.data;

    return {
      thread,
      latestRun: runRes.data?.[0] ?? null,
    };
  }

  const [a, b] = await Promise.all([
    getThreadWithLatestRun(aId),
    getThreadWithLatestRun(bId),
  ]);

  if (!a || !b) {
    return Response.json({ error: "One or both threads not found" }, { status: 404 });
  }

  return Response.json({ a, b });
}
