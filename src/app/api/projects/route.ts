import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createProject } from "@/lib/orchestrator";
import { strategicBriefSchema } from "@/lib/agents/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** GET /api/projects — List user's projects */
export async function GET(req: NextRequest) {
  const ownerToken = req.nextUrl.searchParams.get("owner_token");
  if (!ownerToken) {
    return NextResponse.json({ error: "owner_token required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, status, current_phase, complexity_class, risk_level, github_repo, deploy_url, created_at, updated_at")
    .eq("owner_token", ownerToken)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data });
}

/** POST /api/projects — Create project from Council thread */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { threadId, ownerToken, name, description } = body;

    if (!threadId || !ownerToken || !name) {
      return NextResponse.json(
        { error: "threadId, ownerToken, and name are required" },
        { status: 400 },
      );
    }

    // Load the StrategicBrief from the thread's latest mission
    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("result")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (missionError || !mission) {
      return NextResponse.json(
        { error: "Could not find StrategicBrief for this thread" },
        { status: 404 },
      );
    }

    // Validate the brief
    const briefResult = strategicBriefSchema.safeParse(mission.result);
    if (!briefResult.success) {
      return NextResponse.json(
        { error: "Invalid StrategicBrief format", details: briefResult.error.message },
        { status: 422 },
      );
    }

    const projectId = await createProject(
      threadId,
      ownerToken,
      name,
      description ?? "",
      briefResult.data,
    );

    return NextResponse.json({ projectId, status: "intake" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
