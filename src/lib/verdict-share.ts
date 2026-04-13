import pako from "pako"

// Minimal verdict shape for URL encoding
export interface ShareableVerdict {
  v: "GO" | "PIVOT" | "DONT"
  s: string   // idea_summary
  c: number   // confidence score
  r: [string, string, string]  // 3 reason texts
  p?: string  // pivot suggestion (if PIVOT)
}

export function encodeVerdict(data: ShareableVerdict): string {
  const json = JSON.stringify(data)
  const compressed = pako.deflate(json)
  return Buffer.from(compressed).toString("base64url")
}

export function decodeVerdict(id: string): ShareableVerdict | null {
  try {
    const compressed = Buffer.from(id, "base64url")
    const json = pako.inflate(compressed, { to: "string" })
    return JSON.parse(json)
  } catch {
    return null
  }
}
