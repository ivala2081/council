import pako from "pako"

// Minimal verdict shape for URL encoding
export interface ShareableVerdict {
  v: "GO" | "PIVOT" | "DONT"
  s: string   // idea_summary
  c: number   // confidence score
  r: [string, string, string]  // 3 reason texts
  p?: string  // pivot suggestion (if PIVOT)
}

// Base64url encode/decode — works in both Node.js and Edge/browser
// (Buffer.from with "base64url" is NOT available in Edge runtime)

function toBase64url(bytes: Uint8Array): string {
  // Convert bytes to regular base64 first
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  // Convert to base64url: replace +→-, /→_, remove trailing =
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64url(str: string): Uint8Array {
  // Convert base64url back to regular base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  // Add padding
  while (base64.length % 4 !== 0) base64 += "="
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function encodeVerdict(data: ShareableVerdict): string {
  const json = JSON.stringify(data)
  const compressed = pako.deflate(json)
  return toBase64url(compressed)
}

export function decodeVerdict(id: string): ShareableVerdict | null {
  try {
    const compressed = fromBase64url(id)
    const json = pako.inflate(compressed, { to: "string" })
    return JSON.parse(json)
  } catch {
    return null
  }
}
