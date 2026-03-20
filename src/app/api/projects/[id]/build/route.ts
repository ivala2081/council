import { NextRequest, NextResponse } from "next/server";
import { runProject } from "@/lib/orchestrator";

// In-memory map of running pipelines (serverless-safe for single instance)
const runningPipelines = new Map<string, boolean>();

/** POST /api/projects/[id]/build — Start build pipeline as background job */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (runningPipelines.get(id)) {
    return NextResponse.json(
      { error: "Build already running for this project" },
      { status: 409 },
    );
  }

  // Fire-and-forget: run pipeline in background, independent of HTTP connection
  runningPipelines.set(id, true);

  const runPipeline = async () => {
    try {
      for await (const update of runProject(id)) {
        // Pipeline writes state to DB — no need to stream here
        console.log(
          `[pipeline:${id.slice(0, 8)}] Phase ${update.phase} — ${update.status}` +
            (update.agent ? ` (${update.agent})` : "") +
            (update.error ? ` ERROR: ${update.error.substring(0, 200)}` : ""),
        );

        // If awaiting approval, pause — user will approve via /approve endpoint
        if (update.status === "awaiting_approval") {
          console.log(`[pipeline:${id.slice(0, 8)}] Paused for human approval at Phase ${update.phase}`);
          break;
        }
      }
    } catch (error) {
      console.error(`[pipeline:${id.slice(0, 8)}] Fatal error:`, error);
    } finally {
      runningPipelines.delete(id);
    }
  };

  // Start in background — don't await
  runPipeline();

  return NextResponse.json({ started: true, projectId: id }, { status: 202 });
}
