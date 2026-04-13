# Spec: v2 Step 10 — Launch Polish (First Impression)

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Steps 1-9 complete, all features working on production
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Fix the 5 issues that would make a first-time visitor bounce or misunderstand the product. No new features — just polish.

1. **Value proposition** — Visitor doesn't know what Council is or why they should trust it
2. **Metadata** — Google/Twitter shows v1 description ("5 dimensions, 7-day action plan") — wrong
3. **Loading state** — 30-second wait with no time indication makes users think it's broken
4. **Favicon** — Generic Next.js favicon, no branding
5. **Footer** — No GitHub link, no "what is this" context, looks unfinished

---

## Critical Context

### 1. Files to Read FIRST

- [src/app/page.tsx](src/app/page.tsx) — ~454 lines. Landing page. **Modified: add value prop section, loading time estimate, footer.**
- [src/app/layout.tsx](src/app/layout.tsx) — 60 lines. Metadata + favicon. **Modified: update metadata, add SVG favicon.**
- [src/lib/i18n.tsx](src/lib/i18n.tsx) — Dictionary. **Modified: add ~12 new strings.**
- [src/components/council-mark.tsx](src/components/council-mark.tsx) — SVG logo. **Read-only — reuse for favicon.**

### 2. GitHub Repo

URL: `https://github.com/ivala2081/council`

This goes in the footer as a subtle link. Open source = trust signal.

### 3. Design Constraints

- All new UI uses existing Tailwind semantic tokens (no new colors)
- No new dependencies
- No new components in `src/components/ui/`
- Mobile-first — everything must work at 375px
- Bilingual — all new strings use `t()`

---

## Implementation Steps (Ordered)

### Step 0: Pre-Flight

1. Read all files from Critical Context
2. Run `npm run build` — confirm pass
3. No new dependencies

### Step 1: Add i18n Strings

Add to `src/lib/i18n.tsx` dictionary (before `} as const`):

```typescript
// -- Landing: Value Proposition --
value_prop_1: {
  en: "Real market data",
  tr: "Gerçek pazar verisi",
},
value_prop_1_desc: {
  en: "Live web search, not guesswork",
  tr: "Canlı web araması, tahmin değil",
},
value_prop_2: {
  en: "3 evidence-backed reasons",
  tr: "3 kanıta dayalı sebep",
},
value_prop_2_desc: {
  en: "Every claim has a source",
  tr: "Her iddia kaynağıyla",
},
value_prop_3: {
  en: "Brutally honest",
  tr: "Acımasızca dürüst",
},
value_prop_3_desc: {
  en: "No sugarcoating, no jargon",
  tr: "Laf kalabalığı yok",
},
loading_estimate: {
  en: "~30 seconds — real data takes a moment",
  tr: "~30 saniye — gerçek veri biraz zaman alır",
},
footer_open_source: {
  en: "Open source",
  tr: "Açık kaynak",
},
footer_built_with: {
  en: "Built with Claude",
  tr: "Claude ile yapıldı",
},
```

### Step 2: Update Metadata in layout.tsx

Replace the existing `metadata` object:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL("https://councilpro.vercel.app"),
  title: "Council — Honest AI verdict on your startup idea",
  description:
    "Get a GO, PIVOT, or DON'T verdict in 30 seconds. Real market data, 3 evidence-backed reasons, brutally honest. No sugarcoating.",
  openGraph: {
    title: "Council — Honest AI verdict on your startup idea",
    description:
      "Get a GO, PIVOT, or DON'T verdict in 30 seconds. Real market data, 3 evidence-backed reasons, brutally honest.",
    type: "website",
    url: "https://councilpro.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Council — Honest AI verdict on your startup idea",
    description:
      "Get a GO, PIVOT, or DON'T verdict in 30 seconds. Real market data, 3 evidence-backed reasons, brutally honest.",
  },
};
```

### Step 3: Replace Favicon with SVG

Next.js App Router supports `icon.tsx` for dynamic SVG favicons. Create `src/app/icon.svg` by generating it from the CouncilMark SVG.

**Delete** `src/app/favicon.ico`.

**Create** `src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <rect width="24" height="24" rx="6" fill="#141414"/>
  <path d="M17 7.5C15.5 5.5 13 4.5 10.5 5C7.5 5.5 5.5 8 5.5 11C5.5 14 7.5 16.5 10.5 17C13 17.5 15.5 16.5 17 14.5" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>
  <circle cx="18" cy="6" r="1.5" fill="#22c55e"/>
  <circle cx="18" cy="18" r="1.5" fill="#22c55e"/>
  <circle cx="19.5" cy="12" r="1.5" fill="#22c55e"/>
</svg>
```

This is the CouncilMark logo on a dark rounded-rect background with green accent. Works at 16×16, 32×32, and larger sizes.

### Step 4: Add Value Proposition to Landing Page

In `src/app/page.tsx`, inside the `viewState === "input"` block, add a value proposition section **between the subheadline and the textarea**:

```tsx
<p className="text-sm text-muted-foreground mb-8">
  {t("subheadline")}
</p>

{/* Value proposition — 3 pillars */}
<div className="flex items-center justify-center gap-6 mb-8 text-center">
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    </div>
    <span className="text-[11px] font-medium text-foreground">{t("value_prop_1")}</span>
    <span className="text-[10px] text-muted-foreground/60">{t("value_prop_1_desc")}</span>
  </div>
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    </div>
    <span className="text-[11px] font-medium text-foreground">{t("value_prop_2")}</span>
    <span className="text-[10px] text-muted-foreground/60">{t("value_prop_2_desc")}</span>
  </div>
  <div className="flex flex-col items-center gap-1">
    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    </div>
    <span className="text-[11px] font-medium text-foreground">{t("value_prop_3")}</span>
    <span className="text-[10px] text-muted-foreground/60">{t("value_prop_3_desc")}</span>
  </div>
</div>

<div className="w-full max-w-xl">
```

### Step 5: Add Loading Time Estimate

In `src/app/page.tsx`, inside the `viewState === "loading"` block, add a time estimate below the loading steps:

```tsx
{viewState === "loading" && (
  <div className="flex-1 flex flex-col items-center justify-center">
    <CouncilMark className="w-8 h-8 text-foreground/60 mb-6 animate-pulse" />
    <div className="space-y-2 text-sm">
      {loadingSteps.slice(0, loadingStep + 1).map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          {i < loadingStep ? (
            <span className="text-emerald-500">✓</span>
          ) : (
            <LoadingDots />
          )}
          <span className={i < loadingStep ? "text-muted-foreground" : "text-foreground"}>
            {step.text}
          </span>
        </div>
      ))}
    </div>
    <p className="text-[11px] text-muted-foreground/40 mt-6">
      {t("loading_estimate")}
    </p>
  </div>
)}
```

The key addition is the `<p>` at the bottom showing `"~30 seconds — real data takes a moment"`.

### Step 6: Add Footer

In `src/app/page.tsx`, add a footer **after `</main>`, before the closing `</div>`** of the outermost container:

```tsx
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-center gap-4 text-[11px] text-muted-foreground/40">
          <a
            href="https://github.com/ivala2081/council"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            {t("footer_open_source")}
          </a>
          <span className="text-muted-foreground/20">·</span>
          <span>{t("footer_built_with")}</span>
        </div>
      </footer>
    </div>
```

### Step 7: Remove Idle Flash

Replace the `viewState === "idle"` block with nothing — or render the same layout as `input` but without content (invisible). Simplest fix: skip idle entirely by initializing `viewState` directly to `"input"`:

**Option A (simplest):** Change initial state from `"idle"` to `"input"`:

```typescript
// OLD:
const [viewState, setViewState] = useState<ViewState>("idle");

// NEW:
const [viewState, setViewState] = useState<ViewState>("input");
```

Then remove the `useEffect` that sets `setViewState("input")` and remove the `viewState === "idle"` render block.

**WARNING:** This may cause hydration issues if any client-only code runs in the `input` render. Test carefully. If it causes problems, keep `"idle"` but replace LoadingDots with an empty placeholder that matches the `input` layout dimensions (prevents layout shift).

**Safer Option B:** Keep idle but render a skeleton that matches the input layout height:

```tsx
{viewState === "idle" && (
  <div className="flex-1 flex flex-col items-center pt-[10vh]">
    {/* Empty placeholder matching input layout dimensions — prevents flash */}
    <div className="h-8 mb-2" />
    <div className="h-5 mb-8" />
    <div className="w-full max-w-xl h-[200px]" />
  </div>
)}
```

**Implementer should try Option A first.** If hydration errors occur, fall back to Option B.

### Step 8: Build & Test

```bash
npm run build
npm run dev
```

---

## What NOT to Build

- ❌ About page / how-it-works page
- ❌ Pricing page
- ❌ Blog
- ❌ Cookie consent banner
- ❌ Analytics integration (Vercel Analytics, Plausible, etc.)
- ❌ WhatsApp / LinkedIn share buttons (deferred — next step)
- ❌ Animated hero illustrations
- ❌ Testimonials / social proof counter
- ❌ New components in `src/components/ui/`
- ❌ New dependencies
- ❌ Changes to API, prompt, or verdict schema

---

## Acceptance Criteria

1. ✅ Value proposition (3 icons + labels) visible between subheadline and textarea
2. ✅ Metadata title: "Council — Honest AI verdict on your startup idea"
3. ✅ Metadata description mentions "GO, PIVOT, or DON'T" and "30 seconds"
4. ✅ No v1 references in metadata ("5 dimensions", "7-day action plan", "Strategic Memory" removed)
5. ✅ Custom SVG favicon (CouncilMark on dark background) replaces default favicon.ico
6. ✅ Loading state shows "~30 seconds" estimate below progress steps
7. ✅ Footer with GitHub link (opens new tab) + "Built with Claude"
8. ✅ Idle flash eliminated or minimized
9. ✅ All new strings bilingual (`t()`)
10. ✅ Dark mode works (semantic tokens)
11. ✅ Mobile 375px — value props wrap or stack, footer fits
12. ✅ `npm run build` passes
13. ✅ No new dependencies

---

## Manual Test Plan

### Test 1: First Impression

1. Open `http://localhost:3000` in incognito (no localStorage)
2. **Expected:**
   - Headline: "Honest verdict on your idea" (EN) or "Fikrine dürüst cevap" (TR)
   - 3 value prop icons below subheadline: globe (real data), clipboard (3 reasons), bolt (brutally honest)
   - Textarea with chips below
   - Footer at bottom: GitHub icon + "Open source" · "Built with Claude"

### Test 2: Metadata Check

```bash
curl -s http://localhost:3000 | grep -oE '<(title|meta property="og:[^"]*"|meta name="twitter:[^"]*")[^>]*>'
```

**Expected:**
- `<title>Council — Honest AI verdict on your startup idea</title>`
- `og:title` = same
- `og:description` contains "GO, PIVOT, or DON'T"
- No "5 dimensions", no "Strategic Memory", no "7-day action plan"

### Test 3: Favicon

1. Open page, check browser tab icon
2. **Expected:** Dark rounded square with green Council logo (not generic Next.js icon)

### Test 4: Loading State

1. Submit any idea
2. Watch loading state
3. **Expected:** Below the progress steps, see: "~30 seconds — real data takes a moment"

### Test 5: Footer Links

1. Scroll to bottom of page (or check after verdict)
2. Click "Open source" link
3. **Expected:** Opens `https://github.com/ivala2081/council` in new tab

### Test 6: Idle Flash

1. Hard refresh the page (Ctrl+Shift+R)
2. **Expected:** No LoadingDots flash — page renders input state directly (or invisible skeleton)

### Test 7: Mobile 375px

1. DevTools → iPhone SE
2. Check value props — do they fit horizontally or wrap gracefully?
3. Check footer — does it fit?

### Test 8: Dark Mode

1. Toggle dark mode
2. Check value prop icons, footer text, loading estimate
3. **Expected:** All readable, no invisible elements

### Test 9: Bilingual

1. Switch to TR
2. Check value props: "Gerçek pazar verisi", "3 kanıta dayalı sebep", "Acımasızca dürüst"
3. Check loading: "~30 saniye — gerçek veri biraz zaman alır"
4. Check footer: "Açık kaynak" · "Claude ile yapıldı"

---

## Reporting Format

```markdown
## Implementation Report — Step 10

**Files modified:**
- `src/app/page.tsx` (before: X lines, after: Y lines)
- `src/app/layout.tsx` (metadata updated)
- `src/lib/i18n.tsx` (added X strings)

**Files created:**
- `src/app/icon.svg` (favicon)

**Files deleted:**
- `src/app/favicon.ico`

**Dependencies added:** none

**Build status:** ✅ pass / ❌ fail

**Test results:**

### Test 1 (first impression): ✅/❌
### Test 2 (metadata): ✅/❌
- Paste og:title value
### Test 3 (favicon): ✅/❌
### Test 4 (loading estimate): ✅/❌
### Test 5 (footer GitHub link): ✅/❌
### Test 6 (idle flash): ✅/❌
### Test 7 (mobile 375px): ✅/❌
### Test 8 (dark mode): ✅/❌
### Test 9 (bilingual): ✅/❌

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
```

---

## Why These 5 Changes

Each one addresses a specific bounce risk for first-time visitors:

| Risk | Fix | Impact |
|---|---|---|
| "What is this?" | Value proposition (3 pillars) | Visitor understands within 3 seconds |
| "Google shows wrong info" | Metadata update | SEO/social correct |
| "Is it broken?" (30s wait) | Loading time estimate | Sets expectation, prevents bounce |
| "Looks unfinished" | Favicon + footer | Professional feel |
| "Can I trust this?" | GitHub link (open source) | Transparency = trust |

These are the minimum viable polish for a public launch. Everything else (testimonials, analytics, blog) is post-launch.
