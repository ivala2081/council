import { supabase } from "./supabase-server";

const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 86400; // 24 hours

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  resetsAt: Date;
}

export async function checkRateLimit(
  ip: string,
  ownerToken?: string
): Promise<RateLimitResult> {
  const keys: string[] = [];

  if (ip && ip !== "unknown") {
    keys.push(`ip:${ip}`);
  }
  if (ownerToken) {
    keys.push(`token:${ownerToken}`);
  }
  if (keys.length === 0) {
    keys.push("ip:unknown");
  }

  try {
    const results = await Promise.all(
      keys.map(async (key) => {
        const { data, error } = await supabase.rpc("check_rate_limit", {
          p_key: key,
          p_max_requests: RATE_LIMIT,
          p_window_seconds: RATE_WINDOW_SECONDS,
        });

        if (error) {
          console.error("[rate-limit] RPC error:", error);
          return { allowed: true, current_count: 0, resets_at: new Date().toISOString() };
        }

        return data?.[0] ?? { allowed: true, current_count: 0, resets_at: new Date().toISOString() };
      })
    );

    // If ANY key is rate-limited, deny
    const denied = results.find((r) => !r.allowed);
    const result = denied || results[0];

    return {
      allowed: result.allowed,
      currentCount: result.current_count,
      resetsAt: new Date(result.resets_at),
    };
  } catch (err) {
    console.error("[rate-limit] Unexpected error:", err);
    // Fail open — don't block users if DB is down
    return { allowed: true, currentCount: 0, resetsAt: new Date() };
  }
}
