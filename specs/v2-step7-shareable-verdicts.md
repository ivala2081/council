# Spec: v2 Step 7 — Shareable Verdict URLs + Dynamic OG Images

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Steps 1-6 complete, v2.1 LIVE on Vercel with all 4 tools working
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Make every verdict shareable with a unique URL that shows a rich preview on Twitter/LinkedIn/WhatsApp. When someone shares a Council verdict, the link shows a custom OG image with the verdict badge, confidence score, and idea summary — driving organic traffic.

**Current state:** The "Copy link" button copies the homepage URL. The "Tweet" button tweets text only. No unique verdict URL exists, no rich link previews.

**After this step:** Every verdict gets a unique URL (`/v/[id]`). Sharing that URL anywhere shows a custom OG image. Visitors to that URL see the full verdict card.

**Architecture decision: NO database.** Verdicts are stored as compressed, URL-safe strings. This means:
- No Supabase dependency for sharing
- No privacy concerns (verdicts are ephemeral unless explicitly shared)
- Instant — no write latency
- Trade-off: URLs are ~200-400 chars long (acceptable for link shorteners)

---

## Critical Context

### 1. Files to Read FIRST

- [src/app/page.tsx](src/app/page.tsx) — 305 lines. Contains verdict state + "Copy link" button delegates to VerdictCard. **Modified: adds verdictId generation + passes to VerdictCard.**

- [src/components/verdict-card.tsx](src/components/verdict-card.tsx) — 331 lines. Contains `handleCopy` and `handleTweet` functions. **Modified: updates share URLs to use verdict ID.**

- [src/app/api/verdict/route.ts](src/app/api/verdict/route.ts) — 758 lines. POST handler. **Modified: adds verdict ID generation + returns in response.**

- [src/app/brief/[id]/opengraph-image.tsx](src/app/brief/[id]/opengraph-image.tsx) — 156 lines. V1 OG image generator using `next/og ImageResponse`. **Read-only reference for OG image pattern.**

- [src/app/layout.tsx](src/app/layout.tsx) — 60 lines. Has `metadataBase` URL. **Modified: update `metadataBase` to `councilpro.vercel.app`.**

### 2. URL-Encoded Verdict Approach

Instead of storing verdicts in a database, we encode the essential verdict data into the URL itself.

**How it works:**

```
1. Verdict generated → extract key fields (verdict, idea_summary, confidence, reasons)
2. JSON.stringify → pako.deflate → base64url encode
3. Verdict ID = base64url string (~200-300 chars)
4. URL: /v/[id] where id = encoded verdict data
5. Visitor opens URL → decode id → render verdict card
```

**Why this approach:**
- Zero infrastructure (no DB, no API, no cold-start penalty)
- Verdicts are self-contained in the URL
- Works offline — the URL IS the data
- No expiration, no cleanup, no storage costs
- Privacy — nothing stored on server

**Trade-off:**
- URLs are long (~300-400 chars). But: Twitter/LinkedIn/WhatsApp all support long URLs. URL shorteners (bit.ly) handle the rest.
- Max URL length is ~2000 chars in most browsers. Our encoded data is ~300-400 chars + `/v/` prefix = well within limits.

### 3. Compression: pako

**Library:** `pako` (npm) — zlib-compatible compression for browser and Node.js.
**Why pako:** It's the standard JS zlib implementation. Compresses JSON strings by ~60-70%. Widely used, zero-dependency, 45KB gzipped.

```typescript
import pako from 'pako'

// Encode
const json = JSON.stringify(minimalVerdict)
const compressed = pako.deflate(json)
const id = Buffer.from(compressed).toString('base64url')

// Decode
const compressed = Buffer.from(id, 'base64url')
const json = pako.inflate(compressed, { to: 'string' })
const verdict = JSON.parse(json)
```

### 4. Minimal Verdict for Sharing

We don't encode the FULL verdict — only what's needed for display + OG image:

```typescript
interface ShareableVerdict {
  v: "GO" | "PIVOT" | "DONT"           // verdict
  s: string                             // idea_summary
  c: number                             // confidence score
  r: [string, string, string]           // 3 reason texts (shortened)
  p?: string                            // pivot_suggestion.suggestion (if PIVOT)
}
```

**Why minimal:** Full verdict JSON is ~2-3KB. Minimal is ~300-500 bytes. After compression + base64url, minimal gives ~200-300 char URLs vs ~1500+ char URLs for full.

### 5. OG Image Pattern (from v1 reference)

The existing `src/app/brief/[id]/opengraph-image.tsx` uses Next.js `ImageResponse` with:
- `export const runtime = "edge"` (required for ImageResponse)
- Inline JSX styles (not Tailwind — OG images use inline styles)
- 1200×630 dimensions (Twitter/LinkedIn standard)

We replicate this pattern for `/v/[id]/opengraph-image.tsx`.

### 6. Claude Code Reference Patterns

**a) Base64url encoding/decoding:**
Standard Node.js `Buffer.from(data).toString('base64url')` and `Buffer.from(str, 'base64url')`. Available in Node 16+.

**b) Dynamic route with encoded params:**
Next.js App Router `[id]` dynamic route. The `id` param is the encoded string. Decode in `page.tsx` and `opengraph-image.tsx`.

---

## Files to Create / Modify

### New Files

| File | Purpose |
|---|---|
| `src/lib/verdict-share.ts` | Encode/decode functions for verdict ↔ URL-safe string |
| `src/app/v/[id]/page.tsx` | Shareable verdict page — decodes ID, renders VerdictCard |
| `src/app/v/[id]/opengraph-image.tsx` | Dynamic OG image for shared verdicts |

### Modified Files

| File | Change |
|---|---|
| `src/app/page.tsx` | Generate verdict ID after API response, pass to VerdictCard |
| `src/components/verdict-card.tsx` | Update `handleCopy` and `handleTweet` to use `/v/[id]` URL |
| `src/app/layout.tsx` | Update `metadataBase` URL |
| `package.json` | Add `pako` dependency |
| `src/lib/i18n.tsx` | Add 2 new strings for share page |

---

## Implementation Steps (Ordered)

### Step 0: Pre-Flight

1. Read all files listed in Critical Context
2. Run `npm run build` — confirm pass
3. Install: `npm install pako && npm install -D @types/pako`

### Step 1: Create `src/lib/verdict-share.ts`

```typescript
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
```

### Step 2: Create `/v/[id]/page.tsx` — Shareable Verdict Page

```tsx
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { decodeVerdict } from "@/lib/verdict-share"
import { SharedVerdictView } from "./shared-verdict-view"

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const data = decodeVerdict(id)
  if (!data) return { title: "Council — Verdict Not Found" }

  const verdictLabel = data.v === "DONT" ? "DON'T" : data.v
  return {
    title: `Council says ${verdictLabel} — ${data.s}`,
    description: data.r[0],
    openGraph: {
      title: `Council says ${verdictLabel}`,
      description: data.s,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Council says ${verdictLabel}`,
      description: data.s,
    },
  }
}

export default async function SharedVerdictPage({ params }: { params: Params }) {
  const { id } = await params
  const data = decodeVerdict(id)
  if (!data) notFound()

  return <SharedVerdictView data={data} />
}
```

### Step 3: Create `/v/[id]/shared-verdict-view.tsx` — Client Component

This is a "use client" component that renders the shared verdict as a simplified card (not the full VerdictCard — we don't have the complete V2Verdict object, only ShareableVerdict).

```tsx
"use client"

import Link from "next/link"
import { CouncilMark } from "@/components/council-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { LangToggle } from "@/components/lang-toggle"
import { useLang } from "@/lib/i18n"
import type { ShareableVerdict } from "@/lib/verdict-share"

const verdictStyles = {
  GO: { label: "GO", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  PIVOT: { label: "PIVOT", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500", bar: "bg-amber-500" },
  DONT: { label: "DON'T", text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500", bar: "bg-red-500" },
}

const confColor = (s: number) => s >= 80 ? "text-emerald-600 dark:text-emerald-400" : s >= 60 ? "text-amber-600 dark:text-amber-400" : s >= 40 ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
const confBar = (s: number) => s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : s >= 40 ? "bg-orange-500" : "bg-red-500"

export function SharedVerdictView({ data }: { data: ShareableVerdict }) {
  const { t } = useLang()
  const config = verdictStyles[data.v]

  const tagline = {
    GO: t("verdict_go_tagline"),
    PIVOT: t("verdict_pivot_tagline"),
    DONT: t("verdict_dont_tagline"),
  }[data.v]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <CouncilMark className="w-5 h-5 text-foreground transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-semibold tracking-tight">Council</span>
          </Link>
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6 py-8">
        <div className="w-full max-w-xl mx-auto space-y-4">
          {/* Verdict card */}
          <div className={`rounded-2xl border ${config.border} ${config.bg} overflow-hidden`}>
            <div className="px-6 pt-6 pb-4">
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                &ldquo;{data.s}&rdquo;
              </p>
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-3 h-3 rounded-full ${config.dot}`} />
                <span className={`text-3xl font-black tracking-tight ${config.text}`}>{config.label}</span>
              </div>
              <p className={`text-sm font-medium ${config.text} opacity-70`}>{tagline}</p>
            </div>

            {/* Confidence */}
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("confidence_label")}</span>
                <span className={`text-sm font-bold tabular-nums ${confColor(data.c)}`}>{data.c}%</span>
              </div>
              <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
                <div className={`h-full rounded-full ${confBar(data.c)} transition-all duration-700`} style={{ width: `${data.c}%` }} />
              </div>
            </div>

            {/* 3 Reasons */}
            <div className="border-t border-foreground/5">
              {data.r.map((reason, i) => (
                <div key={i} className={`px-6 py-4 ${i < 2 ? "border-b border-foreground/5" : ""}`}>
                  <div className="flex gap-3">
                    <span className={`shrink-0 w-6 h-6 rounded-full ${config.bg} ${config.text} flex items-center justify-center text-xs font-bold border ${config.border}`}>{i + 1}</span>
                    <p className="text-sm text-foreground leading-relaxed">{reason}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pivot suggestion */}
            {data.p ? (
              <div className="px-6 py-4 border-t border-foreground/5 bg-foreground/[0.02]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t("instead_try")}</p>
                <p className="text-sm font-medium text-foreground">{data.p}</p>
              </div>
            ) : null}
          </div>

          {/* CTA */}
          <div className="text-center pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-80 transition-all"
            >
              {t("share_cta")}
            </Link>
            <p className="text-[11px] text-muted-foreground/50 mt-3">
              {t("share_powered_by")}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
```

### Step 4: Create `/v/[id]/opengraph-image.tsx` — Dynamic OG Image

```tsx
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
```

### Step 5: Add i18n Strings

In `src/lib/i18n.tsx`, add these 2 entries to the dictionary:

```typescript
// -- Share page --
share_cta: {
  en: "Get your own verdict",
  tr: "Kendi fikrine cevap al",
},
share_powered_by: {
  en: "Powered by Council — AI that tells the truth about your idea",
  tr: "Council — fikrine kimsenin söylemediği gerçeği söyleyen AI",
},
```

### Step 6: Update `page.tsx` — Generate Verdict ID

In `src/app/page.tsx`:

1. Add import:
```typescript
import { encodeVerdict, type ShareableVerdict } from "@/lib/verdict-share"
```

2. Add state:
```typescript
const [verdictId, setVerdictId] = useState<string | null>(null)
```

3. After `setVerdict(result.data)` in handleSubmit, generate the shareable ID:
```typescript
setVerdict(result.data)
setViewState("verdict")

// Generate shareable verdict ID
const shareable: ShareableVerdict = {
  v: result.data.verdict,
  s: result.data.idea_summary,
  c: result.data.confidence.score,
  r: result.data.reasons.map(r => r.text).slice(0, 3) as [string, string, string],
  ...(result.data.pivot_suggestion?.suggestion && { p: result.data.pivot_suggestion.suggestion }),
}
setVerdictId(encodeVerdict(shareable))
```

4. Pass `verdictId` to VerdictCard:
```tsx
<VerdictCard verdict={verdict} missionId={null} verdictId={verdictId} />
```

5. In the "Try another idea" reset, clear verdictId:
```typescript
setVerdictId(null)
```

### Step 7: Update `verdict-card.tsx` — Use Verdict ID for Sharing

1. Add `verdictId` to props:
```typescript
interface VerdictCardProps {
  verdict: V2Verdict
  missionId?: string | null
  verdictId?: string | null  // NEW
}

export function VerdictCard({ verdict, missionId, verdictId }: VerdictCardProps) {
```

2. Update `handleCopy`:
```typescript
const handleCopy = () => {
  const url = verdictId
    ? `${window.location.origin}/v/${verdictId}`
    : missionId
      ? `${window.location.origin}/brief/${missionId}`
      : window.location.href
  navigator.clipboard.writeText(url).then(() => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  })
}
```

3. Update `handleTweet`:
```typescript
const handleTweet = () => {
  const text = verdict.shareable?.tweet ?? `Council verdict: ${verdict.verdict} — ${verdict.idea_summary}`
  const url = verdictId ? `${window.location.origin}/v/${verdictId}` : ""
  const tweetUrl = url
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  window.open(tweetUrl, "_blank")
}
```

### Step 8: Update `layout.tsx` — Fix metadataBase

```typescript
// OLD:
metadataBase: new URL("https://council-zeta.vercel.app"),

// NEW:
metadataBase: new URL("https://councilpro.vercel.app"),
```

Also update the openGraph URL:
```typescript
url: "https://councilpro.vercel.app",
```

### Step 9: Build & Test

```bash
npm install pako @types/pako
npm run build
npm run dev
```

---

## What NOT to Build

- ❌ Database storage for verdicts (no Supabase writes)
- ❌ Verdict history / fikir günlüğü (separate spec)
- ❌ Expiring / deleteable share links
- ❌ Custom URL slugs (e.g., `/v/my-idea-name`)
- ❌ QR code generation
- ❌ Facebook / LinkedIn specific share buttons
- ❌ Analytics / click tracking on shared links
- ❌ Authentication for viewing shared verdicts
- ❌ Rate limiting on share page
- ❌ Changes to `/api/verdict` response shape
- ❌ Changes to system prompt
- ❌ Changes to existing VerdictSchema

## What NOT to Change

- ❌ API route logic (only adds verdictId to frontend, API unchanged)
- ❌ System prompt
- ❌ Golden tests
- ❌ Existing `/brief/[id]` pages (v1, leave untouched)

---

## Acceptance Criteria

1. ✅ `npm install pako @types/pako` — only new dependency
2. ✅ `src/lib/verdict-share.ts` exists with `encodeVerdict` and `decodeVerdict` functions
3. ✅ `/v/[id]` page renders a verdict card from decoded URL data
4. ✅ `/v/[id]/opengraph-image` generates a 1200×630 PNG with verdict badge, confidence, summary, 3 reasons
5. ✅ "Copy link" button generates `/v/[encoded-id]` URL (not homepage URL)
6. ✅ "Tweet" button includes the shareable URL in the tweet
7. ✅ Shared URL is < 500 characters total
8. ✅ Invalid/corrupted IDs show 404 page (not crash)
9. ✅ `npm run build` passes
10. ✅ OG meta tags are present in `/v/[id]` page source
11. ✅ OG image renders correctly (check with og-image debugger or curl)
12. ✅ Dark mode works on shared verdict page
13. ✅ Mobile (375px) — shared verdict page is responsive
14. ✅ Bilingual — shared verdict page supports EN/TR toggle
15. ✅ `metadataBase` updated to `councilpro.vercel.app`

---

## Manual Test Plan

```bash
npm run dev
```

### Test 1: Generate a Shareable Verdict

1. Open `http://localhost:3000`
2. Submit: "AI tool that reads legal contracts for freelancers"
3. Wait for verdict
4. Click "Copy link"
5. Paste the copied URL somewhere (notepad)

**Expected:**
- URL format: `http://localhost:3000/v/[base64url-encoded-string]`
- URL length < 500 chars
- URL does NOT contain the homepage path (not `http://localhost:3000`)

### Test 2: Open Shared Verdict URL

1. Open the copied URL from Test 1 in a new browser tab (or incognito)
2. **Expected:**
   - Verdict card renders with GO/PIVOT/DONT badge
   - Confidence bar shows score
   - 3 reasons listed
   - If PIVOT, shows pivot suggestion
   - "Get your own verdict" CTA button at bottom
   - Click CTA → goes to homepage
   - Header has Council logo + LangToggle + ThemeToggle

### Test 3: OG Image Renders

```bash
# Check OG meta tags
curl -s http://localhost:3000/v/[paste-id-here] | grep -oE '<meta property="og:[^"]*" content="[^"]*"'

# Check OG image endpoint directly
curl -s -o /tmp/og-test.png http://localhost:3000/v/[paste-id-here]/opengraph-image
# Open /tmp/og-test.png — should show verdict card image
```

**Expected:**
- OG title: "Council says GO/PIVOT/DON'T — [idea_summary]"
- OG description: first reason text
- OG image URL points to `/v/[id]/opengraph-image`
- Image is 1200×630 PNG with verdict badge, confidence, idea summary, 3 reasons

### Test 4: Tweet with URL

1. From verdict view, click "Tweet"
2. **Expected:** Twitter intent opens with:
   - Tweet text (from verdict.shareable.tweet or fallback)
   - URL appended: `https://localhost:3000/v/[id]`

### Test 5: Invalid/Corrupted ID

```bash
curl -s http://localhost:3000/v/invalidgarbage -o /dev/null -w "HTTP %{http_code}"
```

**Expected:** HTTP 404 (not 500, not crash)

### Test 6: Very Long Idea (URL Length Check)

1. Submit a 2000-character idea (maximum allowed)
2. Copy the share link
3. Measure URL length

**Expected:** URL < 500 chars (reasons are truncated in ShareableVerdict)

### Test 7: DONT Verdict Share

1. Submit: "Instagram clone yapmak istiyorum"
2. Copy share link
3. Open in new tab

**Expected:**
- DONT badge with red styling
- No pivot suggestion section
- OG image shows red "DON'T" badge

### Test 8: PIVOT Verdict Share

1. Submit: "AI podcast platform for everyone"
2. Copy share link
3. Open in new tab

**Expected:**
- PIVOT badge with amber styling
- Pivot suggestion section visible
- `data.p` field populated

### Test 9: Dark Mode on Shared Page

1. Open shared verdict URL
2. Toggle dark mode
3. **Expected:** All elements use semantic tokens, no white-on-white

### Test 10: Mobile (375px) on Shared Page

1. Open shared verdict URL in DevTools mobile viewport
2. **Expected:** Card fits, no overflow, CTA button visible

### Test 11: Bilingual on Shared Page

1. Open shared verdict URL
2. Click "TR" toggle
3. **Expected:** CTA, tagline, confidence label switch to Turkish

### Test 12: Encode/Decode Roundtrip

```bash
# In Node.js console or a test script:
node -e "
const { encodeVerdict, decodeVerdict } = require('./src/lib/verdict-share');
const data = { v: 'GO', s: 'AI contract tool', c: 82, r: ['Reason 1', 'Reason 2', 'Reason 3'] };
const id = encodeVerdict(data);
console.log('Encoded length:', id.length);
console.log('Decoded:', JSON.stringify(decodeVerdict(id)));
console.log('Roundtrip OK:', JSON.stringify(decodeVerdict(id)) === JSON.stringify(data));
"
```

**Expected:** Roundtrip OK: true, encoded length < 200

---

## Reporting Format

```markdown
## Implementation Report — Step 7

**Files created:**
- `src/lib/verdict-share.ts` (X lines)
- `src/app/v/[id]/page.tsx` (X lines)
- `src/app/v/[id]/shared-verdict-view.tsx` (X lines)
- `src/app/v/[id]/opengraph-image.tsx` (X lines)

**Files modified:**
- `src/app/page.tsx` (added verdictId state + encoding)
- `src/components/verdict-card.tsx` (updated share URLs)
- `src/app/layout.tsx` (updated metadataBase)
- `src/lib/i18n.tsx` (added 2 strings)

**Dependencies added:** `pako` (version X), `@types/pako` (devDep)

**Build status:** ✅ pass / ❌ fail

**Sample share URL:** [paste one actual generated URL]
**URL length:** X chars

**Test results:**

### Test 1: Generate shareable verdict: ✅/❌
### Test 2: Open shared URL: ✅/❌
### Test 3: OG image renders: ✅/❌
### Test 4: Tweet with URL: ✅/❌
### Test 5: Invalid ID → 404: ✅/❌
### Test 6: Long idea URL < 500: ✅/❌
### Test 7: DONT share: ✅/❌
### Test 8: PIVOT share with suggestion: ✅/❌
### Test 9: Dark mode: ✅/❌
### Test 10: Mobile 375px: ✅/❌
### Test 11: Bilingual: ✅/❌
### Test 12: Encode/decode roundtrip: ✅/❌

**OG image check:** [paste og:title and og:image meta from curl]

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
**Questions for prompt engineer:** [optional]
```

---

## Why URL-Encoded Instead of Database

| Aspect | Database (Supabase) | URL-encoded (pako) |
|---|---|---|
| Infrastructure | Requires Supabase | Zero |
| Latency | Write: 50-200ms | Encode: <1ms |
| Privacy | Verdicts stored permanently | Nothing stored |
| Expiration | Needs cleanup job | URLs never expire |
| Dependency | Supabase must be available | Works offline |
| URL length | Short (`/v/abc123`) | Longer (`/v/eJy...`, ~300-400 chars) |
| Searchability | Can query by verdict type | Cannot |
| Analytics | Can count shares | Cannot (without separate tracking) |

For MVP: URL-encoded wins. If we later need analytics or search, we add Supabase writes as an OPTIONAL enhancement — the URL-encoded approach stays as the primary sharing mechanism.
