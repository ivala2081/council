type EventName =
  | "brief_generated"
  | "verdict_generated"
  | "thread_viewed"
  | "second_run_submitted"
  | "delta_banner_viewed"
  | "share_clicked"
  | "share_copied"
  | "feedback_submitted";

interface TrackEventPayload {
  event: EventName;
  owner_token?: string;
  thread_id?: string;
  mission_id?: string;
  run_number?: number;
  verdict?: string;
  score?: number;
  score_delta?: number;
  metadata?: Record<string, unknown>;
}

export function trackEvent(payload: TrackEventPayload): void {
  const ownerToken =
    payload.owner_token ||
    (typeof window !== "undefined"
      ? localStorage.getItem("council_owner_token")
      : null) ||
    undefined;

  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, owner_token: ownerToken }),
  }).catch(() => {});
}
