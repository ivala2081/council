// Full E2E pipeline test — runs all phases from project creation to completion
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { createProject, runProject, approvePhase } = await import("./src/lib/orchestrator");
  const { createClient } = await import("@supabase/supabase-js");

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Load the StrategicBrief from existing thread
  const THREAD_ID = "1d38b41f-d1f5-4d01-a529-a66ba2a2e581";
  const OWNER_TOKEN = "9a38f4a9-79b7-48bb-a851-dd4582fc9034";

  const { data: mission } = await sb
    .from("missions")
    .select("result")
    .eq("thread_id", THREAD_ID)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!mission?.result) {
    console.error("No completed brief found!");
    process.exit(1);
  }

  // Step 1: Create project
  console.log("=== STEP 1: Creating project ===");
  const projectId = await createProject(
    THREAD_ID,
    OWNER_TOKEN,
    "AI Meal Planner",
    "AI-powered meal planning app for busy professionals in Turkey",
    mission.result,
  );
  console.log("Project created:", projectId);

  // Step 2: Run pipeline with auto-approval
  console.log("\n=== STEP 2: Running pipeline ===");
  const startTime = Date.now();

  async function runAndApprove(): Promise<void> {
    for await (const update of runProject(projectId)) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const icon =
        update.status === "completed" ? "✓" :
        update.status === "agent_completed" ? "✓" :
        update.status === "agent_failed" ? "✗" :
        update.status === "failed" ? "✗" :
        update.status === "running" ? "▶" :
        update.status === "awaiting_approval" ? "⏸" : "•";

      console.log(
        `[${elapsed}s] ${icon} Phase ${update.phase} — ${update.status}` +
          (update.agent ? ` (${update.agent})` : "") +
          (update.error ? `\n    ERROR: ${update.error.substring(0, 300)}` : ""),
      );

      if (update.status === "awaiting_approval") {
        console.log("    >>> Auto-approving...");
        await approvePhase(projectId, update.phase, true);
        await runAndApprove();
        return;
      }
    }
  }

  await runAndApprove();

  // Step 3: Print results
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n=== RESULTS (${totalTime}s total) ===`);

  const { data: project } = await sb.from("projects").select("status, current_phase").eq("id", projectId).single();
  console.log("Final status:", project?.status, "| Phase:", project?.current_phase);

  const { data: outputs } = await sb.from("phase_outputs").select("phase, agent_name").eq("project_id", projectId).order("created_at");
  console.log("Phase outputs:", outputs?.map((o: { phase: number; agent_name: string }) => `P${o.phase}:${o.agent_name}`).join(", "));

  const { data: files } = await sb.from("generated_files").select("file_path, language").eq("project_id", projectId);
  console.log("Generated files:", files?.length || 0);
  files?.forEach((f: { file_path: string; language: string }) => console.log(`  ${f.file_path} (${f.language})`));

  const { data: audit } = await sb.from("audit_log").select("event_type, agent_name, duration_ms, error_message").eq("project_id", projectId).order("created_at");
  console.log("\nAudit log:");
  audit?.forEach((a: { event_type: string; agent_name: string; duration_ms: number; error_message: string }) => {
    const status = a.event_type === "error" ? "FAIL" : "OK";
    const time = a.duration_ms ? `${Math.round(a.duration_ms / 1000)}s` : "";
    const err = a.error_message ? ` | ${a.error_message.substring(0, 120)}` : "";
    console.log(`  ${status} ${a.agent_name} ${time}${err}`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
