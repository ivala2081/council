import { createClient } from "@supabase/supabase-js";

const ADMIN_KEY = process.env.ADMIN_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!ADMIN_KEY) {
    return Response.json({ error: "Admin endpoint not configured" }, { status: 503 });
  }

  if (key !== ADMIN_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // --- Threads & Return Rate ---
    const { data: threads } = await supabase
      .from("threads")
      .select("id, owner_token, run_count, created_at, updated_at");

    const totalThreads = threads?.length ?? 0;

    // Unique owner tokens
    const ownerTokens = new Set(threads?.map((t) => t.owner_token) ?? []);
    const totalOwners = ownerTokens.size;

    // Owners that have at least one thread with run_count >= 2
    const returningOwners = new Set(
      threads?.filter((t) => t.run_count >= 2).map((t) => t.owner_token) ?? []
    );
    const returnRate = totalOwners > 0 ? returningOwners.size / totalOwners : 0;

    // --- Time to Return (avg days between run 1 and run 2) ---
    // For threads with run_count >= 2, use created_at vs updated_at as proxy
    const threadsWithReturns = threads?.filter((t) => t.run_count >= 2) ?? [];
    let avgDaysToReturn: number | null = null;
    if (threadsWithReturns.length > 0) {
      const totalDays = threadsWithReturns.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const updated = new Date(t.updated_at).getTime();
        return sum + (updated - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgDaysToReturn = totalDays / threadsWithReturns.length;
    }

    // --- Missions ---
    const { data: missions } = await supabase
      .from("missions")
      .select("id, status, total_cost_usd, result");

    const totalMissions = missions?.length ?? 0;
    const completedMissions = missions?.filter((m) => m.status === "completed") ?? [];
    const failedMissions = missions?.filter((m) => m.status === "failed") ?? [];

    // Average cost per mission (completed only)
    let avgCostPerMission: number | null = null;
    if (completedMissions.length > 0) {
      const totalCost = completedMissions.reduce(
        (sum, m) => sum + (parseFloat(m.total_cost_usd) || 0),
        0
      );
      avgCostPerMission = totalCost / completedMissions.length;
    }

    // Total spend
    const totalSpend = missions?.reduce(
      (sum, m) => sum + (parseFloat(m.total_cost_usd) || 0),
      0
    ) ?? 0;

    // --- Verdict Distribution ---
    const verdictCounts: Record<string, number> = {
      strong: 0,
      promising: 0,
      risky: 0,
      weak: 0,
    };
    for (const m of completedMissions) {
      const verdict = (m.result as Record<string, unknown>)?.verdict as
        | Record<string, unknown>
        | undefined;
      const v = verdict?.verdict as string | undefined;
      if (v && v in verdictCounts) {
        verdictCounts[v]++;
      }
    }

    // --- Score Distribution ---
    const scores = completedMissions
      .map((m) => {
        const verdict = (m.result as Record<string, unknown>)?.verdict as
          | Record<string, unknown>
          | undefined;
        return verdict?.councilScore as number | undefined;
      })
      .filter((s): s is number => typeof s === "number");

    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;
    const minScore = scores.length > 0 ? Math.min(...scores) : null;
    const maxScore = scores.length > 0 ? Math.max(...scores) : null;

    // --- Weekly Cohorts ---
    const cohortMap = new Map<string, { total: number; returned: number }>();
    for (const t of threads ?? []) {
      const d = new Date(t.created_at);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      const week = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      const entry = cohortMap.get(week) || { total: 0, returned: 0 };
      entry.total++;
      if (t.run_count >= 2) {
        const daysBetween = (new Date(t.updated_at).getTime() - d.getTime()) / 86400000;
        if (daysBetween <= 7) entry.returned++;
      }
      cohortMap.set(week, entry);
    }
    const cohorts = Array.from(cohortMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, data]) => ({
        week,
        total: data.total,
        returned: data.returned,
        returnRate: data.total > 0 ? Math.round((data.returned / data.total) * 1000) / 10 : 0,
      }));

    // --- Time to Return Distribution ---
    const timeToReturnBuckets: Record<string, number> = {
      "0": 0, "1": 0, "2": 0, "3": 0, "4-7": 0, "7+": 0,
    };
    for (const t of threadsWithReturns) {
      const days = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86400000;
      if (days < 1) timeToReturnBuckets["0"]++;
      else if (days < 2) timeToReturnBuckets["1"]++;
      else if (days < 3) timeToReturnBuckets["2"]++;
      else if (days < 4) timeToReturnBuckets["3"]++;
      else if (days <= 7) timeToReturnBuckets["4-7"]++;
      else timeToReturnBuckets["7+"]++;
    }

    // --- Run Count Histogram ---
    const runHistogram: Record<number, number> = {};
    for (const t of threads ?? []) {
      const key = t.run_count >= 4 ? 4 : t.run_count;
      runHistogram[key] = (runHistogram[key] || 0) + 1;
    }

    // --- Event Funnel ---
    const { data: events } = await supabase
      .from("events")
      .select("event_name");
    const funnel: Record<string, number> = {
      brief_generated: 0,
      thread_viewed: 0,
      second_run_submitted: 0,
      delta_banner_viewed: 0,
      share_clicked: 0,
      feedback_submitted: 0,
    };
    for (const e of events ?? []) {
      if (e.event_name in funnel) {
        funnel[e.event_name]++;
      }
    }

    // --- Feedback ---
    const { data: feedbacks } = await supabase
      .from("feedback")
      .select("overall_score, would_pay");

    const totalFeedbacks = feedbacks?.length ?? 0;
    let avgFeedbackScore: number | null = null;
    let wouldPayRate: number | null = null;

    if (totalFeedbacks > 0) {
      const scoredFeedbacks = feedbacks!.filter((f) => f.overall_score != null);
      if (scoredFeedbacks.length > 0) {
        avgFeedbackScore =
          scoredFeedbacks.reduce((sum, f) => sum + f.overall_score, 0) /
          scoredFeedbacks.length;
      }

      const wouldPayCount = feedbacks!.filter((f) => f.would_pay === true).length;
      wouldPayRate = wouldPayCount / totalFeedbacks;
    }

    return Response.json({
      generatedAt: new Date().toISOString(),
      retention: {
        totalOwners,
        totalThreads,
        returningOwners: returningOwners.size,
        returnRate: Math.round(returnRate * 1000) / 10, // percentage with 1 decimal
        avgDaysToReturn: avgDaysToReturn != null ? Math.round(avgDaysToReturn * 10) / 10 : null,
        threadsWithMultipleRuns: threadsWithReturns.length,
      },
      missions: {
        total: totalMissions,
        completed: completedMissions.length,
        failed: failedMissions.length,
        running: missions?.filter((m) => m.status === "running").length ?? 0,
        avgCostPerMission: avgCostPerMission != null
          ? Math.round(avgCostPerMission * 10000) / 10000
          : null,
        totalSpend: Math.round(totalSpend * 10000) / 10000,
      },
      verdicts: verdictCounts,
      scores: {
        avg: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
        min: minScore,
        max: maxScore,
        count: scores.length,
      },
      feedback: {
        total: totalFeedbacks,
        avgOverallScore: avgFeedbackScore != null
          ? Math.round(avgFeedbackScore * 100) / 100
          : null,
        wouldPayRate: wouldPayRate != null
          ? Math.round(wouldPayRate * 1000) / 10
          : null,
      },
      cohorts,
      timeToReturn: timeToReturnBuckets,
      funnel,
      runHistogram,
    });
  } catch (err) {
    console.error("[admin/stats] Error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
