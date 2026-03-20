import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { ids } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ missions: [] });
  }

  // Limit to 50 most recent
  const safeIds = ids.slice(0, 50);

  const { data, error } = await supabase
    .from("missions")
    .select("id, prompt, result, pipeline_mode, status, created_at")
    .in("id", safeIds)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ missions: [] });
  }

  // Return only summary data, not the full result
  const missions = data.map((m) => ({
    id: m.id,
    prompt: m.prompt?.slice(0, 200) ?? "",
    verdict: m.result?.verdict?.verdict ?? m.result?.executiveSummary?.verdict ?? null,
    score: m.result?.verdict?.councilScore ?? m.result?.executiveSummary?.councilScore ?? null,
    summary: (m.result?.verdict?.summary ?? m.result?.executiveSummary?.summary ?? "").slice(0, 200) || null,
    mode: m.pipeline_mode,
    createdAt: m.created_at,
  }));

  return Response.json({ missions });
}
