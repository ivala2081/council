import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Council — Honest AI verdict on your startup idea";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #141414 0%, #0c1a3d 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {/* CouncilMark SVG */}
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M17 7.5C15.5 5.5 13 4.5 10.5 5C7.5 5.5 5.5 8 5.5 11C5.5 14 7.5 16.5 10.5 17C13 17.5 15.5 16.5 17 14.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M15 9.5C14 8.5 12.5 8 11 8.5C9.5 9 8.5 10.5 8.5 12C8.5 13.5 9.5 15 11 15.5C12.5 16 14 15.5 15 14.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="18" cy="6" r="1.5" fill="white" />
            <circle cx="18" cy="18" r="1.5" fill="white" />
            <circle cx="19.5" cy="12" r="1.5" fill="white" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 56, fontWeight: 800, color: "white", letterSpacing: -1 }}>
              Council
            </span>
            <span style={{ fontSize: 24, color: "#888", marginTop: 4 }}>
              Honest AI verdict on your startup idea
            </span>
          </div>
        </div>
        {/* Subtle accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #3b82f6, #22c55e, #eab308, #ef4444)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
