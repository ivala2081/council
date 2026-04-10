import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-server";

/** GET /api/projects/[id] — Get project with all phases and files */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch phase outputs
  const { data: phases } = await supabase
    .from("phase_outputs")
    .select("id, phase, agent_name, output, confidence, tokens_used, cost_usd, model_used, verification_passed, human_approved, human_approved_at, created_at")
    .eq("project_id", id)
    .order("phase", { ascending: true })
    .order("created_at", { ascending: true });

  // Fetch generated files (latest version of each)
  const { data: allFiles } = await supabase
    .from("generated_files")
    .select("id, file_path, content, language, phase, agent_name, version, created_at")
    .eq("project_id", id)
    .order("version", { ascending: false });

  // Deduplicate: keep only latest version of each file (already sorted by version DESC)
  const seen = new Set<string>();
  const files = (allFiles ?? []).filter((file) => {
    if (seen.has(file.file_path)) return false;
    seen.add(file.file_path);
    return true;
  });

  // Fetch recent audit log
  const { data: auditLog } = await supabase
    .from("audit_log")
    .select("id, event_type, phase, agent_name, model_used, duration_ms, tokens_used, cost_usd, error_message, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Calculate totals
  const totalTokens = (phases ?? []).reduce((sum, p) => sum + (p.tokens_used ?? 0), 0);
  const totalCost = (phases ?? []).reduce((sum, p) => sum + (Number(p.cost_usd) || 0), 0);

  return NextResponse.json({
    project,
    phases: phases ?? [],
    files,
    auditLog: auditLog ?? [],
    totals: {
      tokens: totalTokens,
      costUsd: totalCost,
      fileCount: files.length,
      phaseCount: (phases ?? []).length,
    },
  });
}
