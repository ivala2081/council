// ============================================================
// Delta Computation
// ============================================================
// Compares two briefs to produce a human-readable delta.
// Used when a founder returns and runs an updated assessment.
// ============================================================

export interface ScoreDelta {
  dimension: string;
  previous: number;
  current: number;
  change: number;
}

export interface BriefDelta {
  scoreDelta: number;
  verdictChange: { from: string; to: string } | null;
  dimensionDeltas: ScoreDelta[];
  resolvedRisks: string[];
  newRisks: string[];
  penaltyChanges: {
    added: string[];
    removed: string[];
  };
  verdictChangeReason: string | null;
}

type BriefLike = Record<string, unknown>;

function getVerdict(brief: BriefLike) {
  const v = brief.verdict as Record<string, unknown> | undefined;
  return v ?? null;
}

function getScoreBreakdown(brief: BriefLike): Record<string, number> | null {
  const v = getVerdict(brief);
  if (!v) return null;
  return (v.scoreBreakdown as Record<string, number>) ?? null;
}

function getRisks(brief: BriefLike): string[] {
  return (brief.whyThisMayFail as string[]) ?? [];
}

function getPenalties(brief: BriefLike): string[] {
  const v = getVerdict(brief);
  if (!v) return [];
  const penalties = v.penalties as Array<{ id: string; applied: boolean }> | undefined;
  if (!penalties) return [];
  return penalties.filter((p) => p.applied).map((p) => p.id);
}

/**
 * Compute the delta between two briefs (previous → current).
 * Returns null if either brief is missing verdict data.
 */
export function computeDelta(
  previousBrief: BriefLike,
  currentBrief: BriefLike
): BriefDelta | null {
  const prevVerdict = getVerdict(previousBrief);
  const currVerdict = getVerdict(currentBrief);
  if (!prevVerdict || !currVerdict) return null;

  const prevScore = (prevVerdict.councilScore as number) ?? 0;
  const currScore = (currVerdict.councilScore as number) ?? 0;

  // Verdict change
  const prevVerdictStr = (prevVerdict.verdict as string) ?? "";
  const currVerdictStr = (currVerdict.verdict as string) ?? "";
  const verdictChange =
    prevVerdictStr !== currVerdictStr
      ? { from: prevVerdictStr, to: currVerdictStr }
      : null;

  // Dimension deltas
  const prevBreakdown = getScoreBreakdown(previousBrief) ?? {};
  const currBreakdown = getScoreBreakdown(currentBrief) ?? {};
  const dimensions = ["team", "market", "traction", "defensibility", "timing"];
  const dimensionDeltas: ScoreDelta[] = dimensions
    .map((d) => ({
      dimension: d,
      previous: prevBreakdown[d] ?? 0,
      current: currBreakdown[d] ?? 0,
      change: (currBreakdown[d] ?? 0) - (prevBreakdown[d] ?? 0),
    }))
    .filter((d) => d.change !== 0);

  // Risk comparison (simple string matching — imperfect but useful)
  const prevRisks = getRisks(previousBrief);
  const currRisks = getRisks(currentBrief);

  // Normalize for comparison (lowercase, trim)
  const normalize = (s: string) => s.toLowerCase().trim().slice(0, 60);
  const prevNormalized = new Set(prevRisks.map(normalize));
  const currNormalized = new Set(currRisks.map(normalize));

  const resolvedRisks = prevRisks.filter((r) => !currNormalized.has(normalize(r)));
  const newRisks = currRisks.filter((r) => !prevNormalized.has(normalize(r)));

  // Penalty changes
  const prevPenalties = new Set(getPenalties(previousBrief));
  const currPenalties = new Set(getPenalties(currentBrief));
  const addedPenalties = [...currPenalties].filter((p) => !prevPenalties.has(p));
  const removedPenalties = [...prevPenalties].filter((p) => !currPenalties.has(p));

  // Generate verdict change reason
  const scoreDelta = currScore - prevScore;
  let verdictChangeReason: string | null = null;

  if (scoreDelta !== 0 || verdictChange) {
    const parts: string[] = [];

    // Score direction
    if (scoreDelta > 0) {
      parts.push(`Score improved by ${scoreDelta} points.`);
    } else if (scoreDelta < 0) {
      parts.push(`Score dropped by ${Math.abs(scoreDelta)} points.`);
    }

    // Top dimension driver
    const sorted = [...dimensionDeltas].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    if (sorted.length > 0) {
      const top = sorted[0];
      const dir = top.change > 0 ? "improved" : "declined";
      parts.push(`${top.dimension.charAt(0).toUpperCase() + top.dimension.slice(1)} ${dir} the most (${top.change > 0 ? "+" : ""}${top.change}).`);
    }

    // Risks
    if (resolvedRisks.length > 0 && newRisks.length === 0) {
      parts.push(`${resolvedRisks.length} risk${resolvedRisks.length > 1 ? "s" : ""} resolved.`);
    } else if (newRisks.length > 0 && resolvedRisks.length === 0) {
      parts.push(`${newRisks.length} new risk${newRisks.length > 1 ? "s" : ""} appeared.`);
    } else if (resolvedRisks.length > 0 && newRisks.length > 0) {
      parts.push(`${resolvedRisks.length} resolved, ${newRisks.length} new risk${newRisks.length > 1 ? "s" : ""}.`);
    }

    // Verdict shift
    if (verdictChange) {
      parts.push(`Verdict shifted from ${verdictChange.from} to ${verdictChange.to}.`);
    }

    verdictChangeReason = parts.join(" ");
  }

  return {
    scoreDelta,
    verdictChange,
    dimensionDeltas,
    resolvedRisks,
    newRisks,
    penaltyChanges: {
      added: addedPenalties,
      removed: removedPenalties,
    },
    verdictChangeReason,
  };
}
