import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";
export const alt = "Council Brief";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors: Record<string, { primary: string; bg: string }> = {
  strong: { primary: "#22c55e", bg: "#052e16" },
  promising: { primary: "#3b82f6", bg: "#0c1a3d" },
  risky: { primary: "#eab308", bg: "#2d2305" },
  weak: { primary: "#ef4444", bg: "#2d0808" },
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("missions")
    .select("result")
    .eq("id", id)
    .eq("status", "completed")
    .single();

  const verdictObj = data?.result?.verdict ?? data?.result?.executiveSummary;
  const verdict = (verdictObj?.verdict as string) ?? "risky";
  const score = (verdictObj?.councilScore as number) ?? 0;
  const summary = (verdictObj?.summary as string) ?? "";
  const scoreBreakdown = verdictObj?.scoreBreakdown as Record<string, number> | undefined;

  const c = colors[verdict] ?? colors.risky;

  const dims = ["Team", "Market", "Traction", "Defensibility", "Timing"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(135deg, #141414 0%, ${c.bg} 100%)`,
          padding: 60,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Left: Score + Verdict */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div style={{ fontSize: 120, fontWeight: 800, color: c.primary, lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: 18, color: "#666", marginTop: 8 }}>/100</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 24,
              background: `${c.primary}20`,
              padding: "8px 16px",
              borderRadius: 9999,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, background: c.primary }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: c.primary }}>
              {verdict.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Right: Summary + Dimensions */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1.2,
            paddingLeft: 40,
          }}
        >
          <p style={{ fontSize: 22, color: "#ccc", lineHeight: 1.5, marginBottom: 32 }}>
            {summary.slice(0, 140)}
            {summary.length > 140 ? "..." : ""}
          </p>

          {scoreBreakdown && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dims.map((dim) => {
                const key = dim.toLowerCase();
                const val = scoreBreakdown[key] ?? 0;
                return (
                  <div key={dim} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 14, color: "#888", width: 100 }}>{dim}</span>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "#333",
                        borderRadius: 3,
                        overflow: "hidden",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: `${(val / 20) * 100}%`,
                          height: "100%",
                          background: c.primary,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 14, color: "#aaa", width: 40, textAlign: "right" }}>
                      {val}/20
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Branding */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 32 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 7.5C15.5 5.5 13 4.5 10.5 5C7.5 5.5 5.5 8 5.5 11C5.5 14 7.5 16.5 10.5 17C13 17.5 15.5 16.5 17 14.5"
                stroke="#555"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="18" cy="6" r="1.5" fill="#555" />
              <circle cx="18" cy="18" r="1.5" fill="#555" />
              <circle cx="19.5" cy="12" r="1.5" fill="#555" />
            </svg>
            <span style={{ fontSize: 14, color: "#555" }}>council-zeta.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
