# Spec: v2 Step 4 — Minimal UI Polish Before First Users

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Steps 1-3 complete, v2.4.0 + Exa real data LIVE on Vercel
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Before sending Council to the first real users, ship 3 minimal UI improvements that address the 3 biggest friction points identified in review:

1. **Onboarding** — First-time visitor doesn't know what to type
2. **Trust** — User can't tell if Council understood the idea correctly
3. **Evidence activation** — Step 3 gave us real Exa URLs but they're not clickable

These 3 changes make Council's trust layer visible and lower onboarding friction — the minimum needed before real users arrive.

**This is NOT a full redesign.** No new pages, no history, no OG images, no about page. Just 3 targeted additions.

---

## Critical Context

### 1. Existing Code to Read FIRST

- [src/app/page.tsx](src/app/page.tsx) — 248 lines. Current flow: idle → input → loading → verdict. **Only this file is modified for items 1 and 2.**

- [src/components/verdict-card.tsx](src/components/verdict-card.tsx) — 297 lines. Renders verdict, confidence, 3 reasons with evidence, pivot suggestion, share bar. **Only this file is modified for item 3.**

- [src/app/api/verdict/route.ts](src/app/api/verdict/route.ts) — API. **Not modified.**

### 2. Design System Context

- **Tailwind CSS 4** with `dark:` variants and semantic color tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`)
- **shadcn/ui base** — buttons, inputs already styled
- **Dark mode** — ThemeToggle in header works; all new UI must use semantic tokens (no hardcoded `#fff`)
- **Mobile** — existing layout is `max-w-xl` with `px-6` padding, already responsive

### 3. Claude Code Reference Patterns

From `C:\repo\claude_ref\code`:

**a) Dynamic placeholder / prompt suggestions:**
File: `src/services/PromptSuggestion/promptSuggestion.ts`, `src/hooks/usePromptSuggestion.ts`
Pattern: Contextual suggestions shown on empty state, dismissed on first keystroke. For this spec, we use a simpler variant: 3 static example chips (no rotation, no telemetry — too much for v2.4).

**b) Status acknowledgment:**
File: `src/components/ContextSuggestions.tsx`
Pattern: Show the AI's interpretation of user input back to the user ("You said X" / "Looking for Y"). We adapt this by showing `"Council heard: {idea_summary}"` above the verdict card.

**c) Evidence click-through:**
No direct Claude Code parallel. Web-native `<a target="_blank">` pattern. Claude Code is terminal-based so links aren't clickable there.

### 4. Step 3 Context (Why Clickable Sources Matter)

Step 3 added Exa search. Now evidence can look like:
```json
{
  "type": "competitor",
  "source": "https://www.reddit.com/r/therapy/comments/abc123",
  "detail": "Users complain BetterHelp is overpriced..."
}
```

**Currently this URL is rendered as plain text** — user can't click it. That's the Step 3 trust layer completely wasted. Item 3 of this spec fixes that.

---

## Implementation — 3 Items

### Item 1: Landing Examples (Chips)

**File:** `src/app/page.tsx`
**Where:** Inside the `viewState === "input"` render block, below the textarea form, above the error inline div.

**What to add:**

A row of 3 clickable example "chips" that fill the textarea when clicked. Only visible when `idea` is empty (clear up immediately when user types anything).

**Examples to use (these 3 exactly — chosen to represent DONT, GO, PIVOT):**

```typescript
const EXAMPLES = [
  { icon: "💡", text: "Instagram clone yapmak istiyorum" },
  { icon: "⚙️", text: "AI tool that reads legal contracts for freelancers" },
  { icon: "🚀", text: "Platform for companies to manage AI agent workforce" },
]
```

**JSX skeleton:**

```tsx
{viewState === "input" && idea.trim().length === 0 && (
  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
    <span className="text-[11px] text-muted-foreground/60 mr-1">Try:</span>
    {EXAMPLES.map((ex) => (
      <button
        key={ex.text}
        type="button"
        onClick={() => setIdea(ex.text)}
        className="text-[11px] px-3 py-1.5 rounded-full border border-border/60 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="mr-1">{ex.icon}</span>
        {ex.text.length > 45 ? ex.text.slice(0, 42) + "…" : ex.text}
      </button>
    ))}
  </div>
)}
```

**Behavior:**
- Chips only render when `viewState === "input"` AND `idea.trim().length === 0`
- Clicking a chip calls `setIdea(ex.text)` — textarea fills with the full text
- Focus stays on textarea (don't steal focus)
- Once user types or clicks, `idea.length > 0`, chips disappear automatically
- No API call, no telemetry for this spec (telemetry deferred)

**Design notes:**
- Very subtle — muted colors, small text, secondary visual weight
- Should NOT compete with the main input box
- Mobile: `flex-wrap` handles overflow gracefully

---

### Item 2: "Council heard" Header

**File:** `src/app/page.tsx`
**Where:** Inside the `viewState === "verdict"` render block, BEFORE the `<VerdictCard>` component.

**What to add:**

A small acknowledgment line showing how Council interpreted the user's idea (`verdict.idea_summary`). Includes a "not quite?" link that returns the user to input mode with their original text preserved.

**State change:**

Currently `handleSubmit` resets `idea` to empty on "Try another idea". We need to preserve the last-submitted idea text so "not quite?" can restore it.

Add a new ref to track last idea:
```typescript
const lastIdeaRef = useRef<string>("")
```

In `handleSubmit`, before the fetch:
```typescript
lastIdeaRef.current = idea.trim()
```

For "not quite?" handler:
```typescript
const handleNotQuite = () => {
  setIdea(lastIdeaRef.current)  // restore previous text
  setVerdict(null)
  setError(null)
  setViewState("input")
}
```

**JSX skeleton:**

```tsx
{viewState === "verdict" && verdict && (
  <div className="py-8">
    {/* Council heard header */}
    <div className="max-w-xl mx-auto mb-4 px-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
        Council heard
      </p>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-foreground leading-relaxed italic">
          &ldquo;{verdict.idea_summary}&rdquo;
        </p>
        <button
          onClick={handleNotQuite}
          className="shrink-0 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors whitespace-nowrap"
        >
          Not quite?
        </button>
      </div>
    </div>

    <VerdictCard verdict={verdict} missionId={null} />

    {/* Existing "Try another idea" button stays below VerdictCard */}
    <div className="mt-6 text-center">
      <button
        onClick={() => {
          setIdea("")
          setVerdict(null)
          setError(null)
          lastIdeaRef.current = ""  // clear ref too
          setViewState("input")
        }}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Try another idea
      </button>
    </div>
  </div>
)}
```

**Behavior:**
- `"Council heard"` label + italicized summary in quotes
- Right-aligned "Not quite?" link (subtle, small)
- Click "Not quite?" → textarea pre-filled with `lastIdeaRef.current`, user can edit and resubmit
- Click "Try another idea" → textarea empty, fresh start
- Two different reset paths, different semantics

**Why this matters:**
Users need to verify Council understood them correctly. If Council heard "Instagram clone" when user meant "niche photo app for climbers", the verdict is wrong. This lets them catch misinterpretation fast.

---

### Item 3: Clickable Evidence Source URLs

**File:** `src/components/verdict-card.tsx`
**Where:** Inside the `{reason.evidence.source ? (...)` block in the reasons map (around line 153-157 of current file).

**What to change:**

Currently `evidence.source` is rendered as plain `<span>`. Replace with conditional: if source is a URL (starts with `http://` or `https://`), render as `<a target="_blank">` with external-link icon. Otherwise keep as span (for non-URL sources like "training_data", "assumption").

**Helper function at top of file (after imports):**

```typescript
function isUrl(s: string | undefined): s is string {
  if (!s) return false
  return s.startsWith("http://") || s.startsWith("https://")
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    const path = u.pathname === "/" ? "" : u.pathname.slice(0, 30)
    return host + (path.length > 0 ? path + (u.pathname.length > 30 ? "…" : "") : "")
  } catch {
    return url.slice(0, 40) + (url.length > 40 ? "…" : "")
  }
}
```

**Replace the existing source rendering:**

```tsx
// OLD:
{reason.evidence.source ? (
  <span className="text-[10px] text-muted-foreground truncate">
    {reason.evidence.source}
  </span>
) : null}

// NEW:
{reason.evidence.source ? (
  isUrl(reason.evidence.source) ? (
    <a
      href={reason.evidence.source}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors truncate inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2"
      title={reason.evidence.source}
    >
      {shortenUrl(reason.evidence.source)}
      <svg className="w-2.5 h-2.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  ) : (
    <span className="text-[10px] text-muted-foreground truncate">
      {reason.evidence.source}
    </span>
  )
) : null}
```

**Behavior:**
- `https://reddit.com/r/therapy/comments/abc` → shortened to `reddit.com/r/therapy/commen…` with external link icon, clickable new tab
- `training_data` → plain text, not clickable (unchanged)
- `assumption` → plain text, not clickable (unchanged)
- Hover: full URL shown in tooltip via `title` attribute
- Underline dotted — subtle visual cue it's a link
- Opens in new tab (`target="_blank"`) with `rel="noopener noreferrer"` (security)

---

## What NOT to Change

- ❌ `src/app/api/verdict/route.ts` — API is frozen
- ❌ `prompts/v2-system-prompt.json` — prompt is frozen
- ❌ VerdictCard other sections (confidence bar, pivot suggestion, financials, tech snapshot, legal flags, share bar) — don't touch
- ❌ Loading state logic
- ❌ Error state logic
- ❌ Existing state management structure
- ❌ shadcn/ui components
- ❌ Tailwind config
- ❌ Dark mode toggle

## What NOT to Build

- ❌ Telemetry / analytics for chip clicks or link clicks
- ❌ Dynamic chip rotation based on time-of-day or user history
- ❌ "Recent verdicts" list
- ❌ Feedback buttons (thumbs up/down) — separate spec
- ❌ Keyboard shortcut hints — separate spec
- ❌ Character counter — separate spec
- ❌ Human-friendly error messages — separate spec
- ❌ OG image generation
- ❌ About page
- ❌ New components in `src/components/ui/`
- ❌ New dependencies

---

## Acceptance Criteria

1. ✅ **Item 1 — Landing chips:**
   - 3 chips visible when `viewState === "input"` AND `idea` is empty
   - Clicking a chip fills textarea with the full example text
   - Chips disappear as soon as `idea` is non-empty
   - Chips do NOT steal focus from textarea

2. ✅ **Item 2 — Council heard header:**
   - When verdict is shown, "Council heard" header appears above VerdictCard
   - Header shows `verdict.idea_summary` in italic quotes
   - "Not quite?" link returns to input state with previous text restored
   - "Try another idea" button clears text completely (different semantic)

3. ✅ **Item 3 — Clickable sources:**
   - Evidence sources that are URLs render as `<a target="_blank">` with external-link icon
   - Non-URL sources (training_data, assumption) render as plain text (unchanged)
   - Shortened URL shown in link text (e.g., `reddit.com/r/therapy/commen…`)
   - Full URL on hover via `title` attribute
   - `rel="noopener noreferrer"` for security

4. ✅ Only 2 files modified: `page.tsx` and `verdict-card.tsx`
5. ✅ No new dependencies
6. ✅ `npm run build` passes
7. ✅ Dark mode works (semantic tokens, no hardcoded colors)
8. ✅ Mobile (375px) — chips wrap, header doesn't overflow

---

## Manual Test Plan

```bash
npm run dev
```

### Test 1: Landing chips (empty state)

1. Open `http://localhost:3000`
2. **Expected:** 3 chips visible below the submit button: Instagram clone, AI legal contracts, AI agent workforce
3. Click the first chip
4. **Expected:** Textarea fills with "Instagram clone yapmak istiyorum", chips disappear
5. Clear the textarea manually
6. **Expected:** Chips reappear

### Test 2: Submit a chip idea

1. Click "AI tool that reads legal contracts for freelancers" chip
2. Press Enter
3. Wait for verdict (~30s with real data)
4. **Expected:** Verdict renders with "Council heard: AI contract reviewer that flags unfair clauses for freelancers" (or similar restatement) above the verdict card

### Test 3: "Not quite?" flow

1. After verdict is shown, click "Not quite?" link
2. **Expected:** Back to input state, textarea pre-filled with last submitted idea
3. Edit the idea (e.g., add "— in Turkish")
4. Press Enter
5. **Expected:** New verdict generates

### Test 4: "Try another idea" flow

1. After verdict is shown, click "Try another idea"
2. **Expected:** Back to input state, textarea EMPTY, chips visible again
3. Click a different chip
4. Submit
5. **Expected:** Fresh verdict

### Test 5: Clickable evidence URLs (with real data)

1. Submit: "Online therapy platform"
2. Wait for verdict (should be DONT with real Exa data)
3. Check the 3 reasons
4. **Expected:** At least one reason has a clickable source link with external-link icon
5. Click the source link
6. **Expected:** Opens in new tab, navigates to actual URL
7. Hover over a source link
8. **Expected:** Tooltip shows full URL

### Test 6: Non-URL evidence (fallback)

1. Submit: "Instagram clone" (likely uses training_data evidence)
2. Check evidence sources
3. **Expected:** Sources that are `training_data` or `assumption` render as plain text, NOT as links

### Test 7: Dark mode

1. Toggle dark mode
2. Go through all 3 items
3. **Expected:** All new UI elements use semantic colors — no white text on white background, no invisible borders

### Test 8: Mobile (375px viewport)

1. Chrome DevTools → iPhone SE
2. Test chips: do they wrap nicely?
3. Test Council heard header: does the "Not quite?" link stay visible?
4. Test clickable source: is it still readable?
5. **Expected:** All 3 items work on mobile without overflow

---

## Reporting Format

```markdown
## Implementation Report — Step 4

**Files modified:**
- `src/app/page.tsx` (before: X lines, after: Y lines)
- `src/components/verdict-card.tsx` (before: X lines, after: Y lines)

**Build status:** ✅ pass / ❌ fail

**Test results:**

### Test 1: Landing chips (empty state)
- 3 chips visible on empty: ✅/❌
- Chip click fills textarea: ✅/❌
- Chips disappear when typing: ✅/❌

### Test 2: Submit from chip
- Verdict renders: ✅/❌
- "Council heard" header visible: ✅/❌
- idea_summary quoted correctly: ✅/❌

### Test 3: "Not quite?" flow
- Returns to input: ✅/❌
- Text preserved: ✅/❌
- New verdict generates: ✅/❌

### Test 4: "Try another idea"
- Text cleared: ✅/❌
- Chips reappear: ✅/❌

### Test 5: Clickable URLs (real data)
- Sample source: [paste one actual URL from verdict]
- Opens in new tab: ✅/❌
- External icon visible: ✅/❌
- Tooltip on hover: ✅/❌

### Test 6: Non-URL evidence
- training_data shown as plain text: ✅/❌

### Test 7: Dark mode
- All 3 items render correctly: ✅/❌

### Test 8: Mobile 375px
- Chips wrap: ✅/❌
- Header doesn't overflow: ✅/❌
- Links readable: ✅/❌

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
**Questions for prompt engineer:** [optional]
```

---

## Why Only These 3

Most UI improvements we could make fall into "would be nice" territory. These 3 are different:

1. **Landing chips** solve a measurable friction point: users land on the page and don't know what to type. One click is always better than an empty input.

2. **"Council heard" header** is the only way to catch misinterpretation. If Council read the idea wrong, the verdict is wrong, and the user needs to know within 1 second of seeing the result.

3. **Clickable sources** is the activation of Step 3's work. We spent time adding real Exa data. If users can't click the URLs, that work delivers zero visible value. This change makes it visible.

Everything else (history, feedback thumbs, OG images, keyboard shortcuts) is speculative until we see real users interact with these basics first.

**Target: ship in 1 hour, collect feedback from first users immediately after.**
