"use client";

import { getVerdict } from "@/lib/design-tokens";

interface VerdictActionBarProps {
  verdict: string;
  onGenesis?: () => void;
  genesisDisabled?: boolean;
  building?: boolean;
}

const VERDICT_CONFIG: Record<
  string,
  {
    message: string;
    ctaLabel: string;
    ctaVariant: "prominent" | "visible" | "muted" | "disabled";
    tease?: string;
  }
> = {
  strong: {
    message: "Exceptional. Council is ready to build.",
    ctaLabel: "Let it build",
    ctaVariant: "prominent",
    tease: "Council is already thinking about your architecture...",
  },
  promising: {
    message: "Solid foundation. Architecture is being prepared...",
    ctaLabel: "Let it build",
    ctaVariant: "visible",
    tease: "Council is already thinking about your architecture...",
  },
  risky: {
    message: "Risks need attention. Address them, then build.",
    ctaLabel: "Build anyway",
    ctaVariant: "muted",
  },
  weak: {
    message: "Not ready to build yet. Here's what to fix first.",
    ctaLabel: "Improve score first",
    ctaVariant: "disabled",
  },
};

export function VerdictActionBar({
  verdict,
  onGenesis,
  genesisDisabled,
  building,
}: VerdictActionBarProps) {
  const key = verdict.toLowerCase();
  const config = VERDICT_CONFIG[key] ?? VERDICT_CONFIG.risky;
  const colors = getVerdict(key as "strong" | "promising" | "risky" | "weak");

  const isDisabled =
    config.ctaVariant === "disabled" || genesisDisabled || building;

  return (
    <div
      data-slot="verdict-action-bar"
      className={`rounded-xl border-l-4 bg-card p-4 flex flex-col gap-3 animate-fade-up ${colors.border}`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-foreground">{config.message}</p>
        {onGenesis && (
          <button
            onClick={onGenesis}
            disabled={isDisabled}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              config.ctaVariant === "prominent"
                ? "bg-foreground text-background hover:opacity-90"
                : config.ctaVariant === "visible"
                ? "bg-foreground text-background hover:opacity-80"
                : config.ctaVariant === "muted"
                ? "border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                : "border text-muted-foreground/40 cursor-not-allowed"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {building ? "Starting..." : config.ctaLabel}
          </button>
        )}
      </div>

      {config.tease && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-status-info animate-pulse-dot" />
          {config.tease}
        </p>
      )}
    </div>
  );
}
