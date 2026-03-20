import { NextRequest, NextResponse } from "next/server";
import { approvePhase } from "@/lib/orchestrator";

/** POST /api/projects/[id]/approve — Human gate approval */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { phase, approved, feedback } = body;

    if (typeof phase !== "number" || typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "phase (number) and approved (boolean) are required" },
        { status: 400 },
      );
    }

    await approvePhase(id, phase, approved, feedback);

    return NextResponse.json({
      status: approved ? "approved" : "revision_requested",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
