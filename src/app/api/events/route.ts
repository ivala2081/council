import { z } from "zod";
import { supabase } from "@/lib/supabase-server";

const ALLOWED_EVENTS = [
  "brief_generated",
  "verdict_generated",
  "thread_viewed",
  "second_run_submitted",
  "delta_banner_viewed",
  "share_clicked",
  "share_copied",
  "feedback_submitted",
] as const;

const EventSchema = z.object({
  event: z.enum(ALLOWED_EVENTS),
  owner_token: z.string().optional(),
  thread_id: z.string().uuid().optional(),
  mission_id: z.string().uuid().optional(),
  run_number: z.number().int().optional(),
  verdict: z.string().optional(),
  score: z.number().optional(),
  score_delta: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// In-memory rate limiter — acceptable for fire-and-forget events on serverless
const ipHits = new Map<string, { count: number; resetTime: number }>();
const EVENTS_PER_HOUR = 100;
const HOUR_MS = 3_600_000;

function checkEventRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);

  if (!entry || now > entry.resetTime) {
    ipHits.set(ip, { count: 1, resetTime: now + HOUR_MS });
    return true;
  }

  if (entry.count >= EVENTS_PER_HOUR) return false;
  entry.count++;
  return true;

  // Cleanup when map grows too large
}

// Periodic cleanup to prevent memory leak
function cleanupIfNeeded() {
  if (ipHits.size > 1000) {
    const now = Date.now();
    for (const [key, val] of ipHits) {
      if (now > val.resetTime) ipHits.delete(key);
    }
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkEventRateLimit(ip)) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  cleanupIfNeeded();

  const { event, owner_token, thread_id, mission_id, run_number, verdict, score, score_delta, metadata } = parsed.data;

  const { error } = await supabase.from("events").insert({
    event_name: event,
    owner_token: owner_token || null,
    thread_id: thread_id || null,
    mission_id: mission_id || null,
    run_number: run_number ?? null,
    verdict: verdict || null,
    score: score ?? null,
    score_delta: score_delta ?? null,
    metadata: metadata || {},
  });

  if (error) {
    console.error("[events] DB error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
