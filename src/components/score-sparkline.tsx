"use client";

import { getVerdict } from "@/lib/design-tokens";

interface ScoreSparklineProps {
  scores: number[];
  width?: number;
  height?: number;
  latestVerdict?: string;
}

export function ScoreSparkline({
  scores,
  width = 80,
  height = 24,
  latestVerdict,
}: ScoreSparklineProps) {
  if (scores.length < 2) return null;

  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const points = scores.map((score, i) => {
    const x = padding + (i / (scores.length - 1)) * chartW;
    const y = padding + chartH - ((score - min) / range) * chartH;
    return { x, y, score };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Last dot color based on verdict
  const verdictKey = latestVerdict?.toLowerCase() ?? "";
  const verdictColors = getVerdict(verdictKey as "strong" | "promising" | "risky" | "weak");
  // Map text class to a fill color
  const fillMap: Record<string, string> = {
    "text-verdict-strong": "oklch(0.55 0.15 145)",
    "text-verdict-promising": "oklch(0.60 0.15 220)",
    "text-verdict-risky": "oklch(0.75 0.15 85)",
    "text-verdict-weak": "oklch(0.65 0.20 25)",
  };
  const lastDotFill = fillMap[verdictColors.text] ?? "currentColor";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      aria-label={`Score trend: ${scores.join(", ")}`}
    >
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/40"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 2.5 : 1.5}
          fill={i === points.length - 1 ? lastDotFill : "currentColor"}
          className={i === points.length - 1 ? "" : "text-muted-foreground/60"}
        />
      ))}
    </svg>
  );
}
