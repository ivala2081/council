import { ImageResponse } from "next/og"
import { decodeVerdict } from "@/lib/verdict-share"

export const runtime = "edge"
export const alt = "Council Verdict"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const colors = {
  GO: { primary: "#22c55e", bg: "#052e16" },
  PIVOT: { primary: "#eab308", bg: "#2d2305" },
  DONT: { primary: "#ef4444", bg: "#2d0808" },
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = decodeVerdict(id)

  if (!data) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#141414", color: "#666", fontSize: 24 }}>
        Council — Verdict not found
      </div>,
      { ...size },
    )
  }

  const c = colors[data.v]
  const label = data.v === "DONT" ? "DON'T" : data.v

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, #141414 0%, ${c.bg} 100%)`,
          padding: 60,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, background: "#555" }} />
          <span style={{ fontSize: 18, color: "#555", fontWeight: 600 }}>Council</span>
        </div>

        {/* Middle: Verdict + Summary */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 16, height: 16, borderRadius: 8, background: c.primary }} />
            <span style={{ fontSize: 72, fontWeight: 900, color: c.primary, letterSpacing: -2 }}>
              {label}
            </span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#888", marginLeft: 16 }}>
              {data.c}% confidence
            </span>
          </div>

          <p style={{ fontSize: 28, color: "#ccc", lineHeight: 1.5, maxWidth: 900 }}>
            &ldquo;{data.s}&rdquo;
          </p>

          {/* 3 Reasons preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 32 }}>
            {data.r.map((reason, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: c.primary, minWidth: 24 }}>
                  {i + 1}.
                </span>
                <span style={{ fontSize: 18, color: "#999", lineHeight: 1.4 }}>
                  {reason.length > 100 ? reason.slice(0, 97) + "..." : reason}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, color: "#555" }}>councilpro.vercel.app</span>
          <span style={{ fontSize: 16, color: c.primary }}>Get your own verdict →</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
