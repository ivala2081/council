import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/threads?token=xxx
 * Fetch all threads for an anonymous owner.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return Response.json({ threads: [] });
  }

  const { data, error } = await supabase
    .from("threads")
    .select("id, name, latest_verdict, latest_score, run_count, created_at, updated_at")
    .eq("owner_token", token)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[threads] Fetch error:", error);
    return Response.json({ threads: [] });
  }

  return Response.json({ threads: data ?? [] });
}
