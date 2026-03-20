"use client";

import type { BriefDelta } from "@/lib/threads/delta";
import { getVerdict, getDelta } from "@/lib/design-tokens";

export function DeltaBanner({ delta }: { delta: BriefDelta }) {
  const deltaStyle = getDelta(delta.scoreDelta);

  return (
    <div className="rounded-xl border bg-card overflow-hidden mb-6">
      <div className="px-5 py-4">
        {/* Score change */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-2xl font-bold tabular-nums ${deltaStyle.text}`}>
            {delta.scoreDelta > 0 ? "+" : ""}
            {delta.scoreDelta}
          </span>
          <span className="text-sm text-muted-foreground">score change</span>

          {delta.verdictChange && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className={`text-sm font-semibold ${getVerdict(delta.verdictChange.from).text}`}>
                {delta.verdictChange.from}
              </span>
              <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className={`text-sm font-semibold ${getVerdict(delta.verdictChange.to).text}`}>
                {delta.verdictChange.to}
              </span>
            </div>
          )}
        </div>

        {/* Dimension changes */}
        {delta.dimensionDeltas.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {delta.dimensionDeltas.map((d) => {
              const style = getDelta(d.change);
              return (
                <span
                  key={d.dimension}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${style.bg}`}
                >
                  <span className="capitalize">{d.dimension}</span>
                  <span className="font-semibold tabular-nums">
                    {d.change > 0 ? "+" : ""}
                    {d.change}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {/* Resolved risks */}
        {delta.resolvedRisks.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] font-medium text-status-success mb-1">Resolved</p>
            {delta.resolvedRisks.slice(0, 2).map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground line-through line-clamp-1">{r}</p>
            ))}
          </div>
        )}

        {/* New risks */}
        {delta.newRisks.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-status-warning mb-1">New concerns</p>
            {delta.newRisks.slice(0, 2).map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground line-clamp-1">{r}</p>
            ))}
          </div>
        )}

        {/* Penalty changes */}
        {(delta.penaltyChanges.removed.length > 0 || delta.penaltyChanges.added.length > 0) && (
          <div className="mt-2 flex gap-3">
            {delta.penaltyChanges.removed.map((p) => (
              <span key={p} className="text-xs text-status-success">
                -{p}
              </span>
            ))}
            {delta.penaltyChanges.added.map((p) => (
              <span key={p} className="text-xs text-status-error">
                +{p}
              </span>
            ))}
          </div>
        )}
        {/* Why verdict changed */}
        {delta.verdictChangeReason && (
          <p className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground leading-relaxed">
            {delta.verdictChangeReason}
          </p>
        )}
      </div>
    </div>
  );
}
