# Spec: v2 Verdict UI — Simplification & Alignment

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 2.0 (revised after 6-item review + Claude Code reference audit)
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Step 1 API route working (verified 2026-04-06, 5/5 tests pass)
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Align the existing UI with the new `/api/verdict` response format and simplify the page to match the v2 UX vision: **input → loading → verdict → drill-down**.

This is NOT a rewrite. The VerdictCard component is already built and working. This step is about **removing complexity**, not adding features.

---

## Critical Context

### 1. Existing Code to Read FIRST

Before changing anything, read these files completely:

- [src/components/verdict-card.tsx](src/components/verdict-card.tsx) — **Already built.** 298 lines, handles GO/PIVOT/DONT, confidence bar, 3 reasons, evidence drill-down, financials, tech snapshot, legal flags, pivot suggestion, share/tweet. **Do not modify.**

- [src/app/page.tsx](src/app/page.tsx) — Current home page. Has 6 view states: `loading | intake | greeting | classic | analyzing | brief`. Also has mode picker (verdict/full/concise/deep) and v1 streaming logic. **This is what needs simplification.**

- [src/app/api/verdict/route.ts](src/app/api/verdict/route.ts) — Step 1 API. Returns `{ ok, data, meta }` format. NOT streaming — regular JSON response. ~310 lines.

- [src/lib/agents/types.ts](src/lib/agents/types.ts) — Contains `V2Verdict` type and `v2VerdictSchema`. The VerdictCard imports from here.

### 2. The v2 UX Vision (from councilV2.md)

```
Landing → Input → Loading (10-30 sn) → Verdict → [Drill-down ▼]
```

No mode picker. No conversation. No thread history. **Just verdict.**

### 3. New API Response Format

Step 1 API returns:

```json
{
  "ok": true,
  "data": { /* V2Verdict */ },
  "meta": { "model": "...", "duration_ms": 4523, "tokens": {...}, "cost_usd": 0.01 }
}
```

The old `/api/mission` used **streaming text**. The new `/api/verdict` returns **a single JSON response**. This changes how page.tsx consumes data — no more stream reader, just `await res.json()`.

**IMPORTANT field name change:** The old page sends `{ prompt: text }`. The new API expects `{ idea: string }`. This is a breaking change — the fetch body must use `idea`, not `prompt`.

### 4. API Response Time Reality

Step 1 test results showed **17-33 seconds** per verdict (not 5-10 seconds as originally estimated). Loading state UX must be calibrated for this range.

### 5. VerdictCard Props Contract

```typescript
// VerdictCard expects this:
interface VerdictCardProps {
  verdict: V2Verdict     // API response's data field
  missionId?: string | null  // v2 has no mission IDs → pass null
}
```

### 6. Claude Code Reference Patterns

From `C:\repo\claude_ref\code` — concrete patterns to adapt:

**a) Minimum display time (prevents flickering):**
File: `src/hooks/useMinDisplayTime.ts`
```typescript
// Ensures each loading step shows for at least N ms
// even if state changes faster. Prevents jarring transitions.
function useMinDisplayTime<T>(value: T, minMs: number): T {
  const [displayed, setDisplayed] = useState(value)
  const lastShownAtRef = useRef(0)
  useEffect(() => {
    const elapsed = Date.now() - lastShownAtRef.current
    if (elapsed >= minMs) {
      lastShownAtRef.current = Date.now()
      setDisplayed(value)
      return
    }
    const timer = setTimeout(() => {
      lastShownAtRef.current = Date.now()
      setDisplayed(value)
    }, minMs - elapsed)
    return () => clearTimeout(timer)
  }, [value, minMs])
  return displayed
}
```
**Use for:** Loading step transitions — each step visible for at least 2 seconds.

**b) Elapsed time display:**
File: `src/hooks/useElapsedTime.ts`
```typescript
// Shows "12s" elapsed timer during loading
// Uses useSyncExternalStore for efficient re-renders (1/sec)
```
**Use for:** Optional elapsed time counter below loading steps.

**c) Error display with truncation:**
File: `src/components/FallbackToolUseErrorMessage.tsx`
```typescript
// Shows first 10 lines of error, "show more" for rest
// Pattern: MAX_RENDERED_LINES + expansion toggle
```
**Use for:** Error state — truncate long API error messages.

**d) State-driven error rendering:**
File: `src/components/TeleportError.tsx`
```typescript
// switch(error.type) → render different UI per error kind
// Pattern: discriminated union on error type
```
**Use for:** Different error display for INVALID_INPUT vs API_OVERLOAD vs TIMEOUT.

### 7. Keyboard Behavior

Preserve Enter-to-submit from current page.tsx: Enter (without Shift) submits the form. Shift+Enter for newline.

### 8. v1 Side Effect Warning

page.tsx currently imports `CouncilConversation`, `CouncilGreeting`, `CompareModal`, and calls `/api/threads`. These are being removed from page.tsx, BUT:
- The v1 pages (`/brief/[id]`, `/thread/[id]`) still exist and may reference these APIs
- Do NOT delete the v1 API routes (`/api/mission`, `/api/threads`, etc.) — only remove them from page.tsx
- Do NOT delete the old component files — just remove their imports from page.tsx

---

## New State Shape

```typescript
type ViewState = "idle" | "input" | "loading" | "verdict"

// State variables for page.tsx:
const [viewState, setViewState] = useState<ViewState>("idle")
const [idea, setIdea] = useState("")
const [verdict, setVerdict] = useState<V2Verdict | null>(null)
const [error, setError] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)
// meta is NOT stored — it's logged to console, not shown to user
```

**Why no `meta` state:** The user doesn't see cost/tokens. We log it to console for debugging. VerdictCard doesn't need meta data.

---

## Implementation Steps (Ordered)

Follow this exact order. Each step should leave the code in a compilable state.

### Step 0: Pre-Flight

1. Open and read all 4 files from Critical Context #1
2. Run `npm run build` — confirm it passes BEFORE changes
3. Note: page.tsx is ~420 lines. Target after simplification: ~150-200 lines.

### Step 1: Remove Unused Imports

Remove these imports from page.tsx:
```
- BriefView
- ConciseBriefView
- CouncilConversation
- CouncilGreeting
- CompareModal
- ShortcutHint
- strategicBriefSchema
- conciseBriefSchema
- type StrategicBrief
- type ConciseBrief
- type IntakeContext
```

Keep:
```
- VerdictCard
- v2VerdictSchema
- type V2Verdict
- ThemeToggle
- CouncilMark
- LoadingDots (will be replaced in Step 6 but keep for now)
- trackEvent
```

Run `npm run build` — fix any TS errors from removed imports.

### Step 2: Replace ViewState and Remove Old State

Replace the type and state declarations:

```typescript
// DELETE these:
type BriefMode = "verdict" | "full" | "concise" | "deep"
type ViewState = "loading" | "intake" | "greeting" | "classic" | "analyzing" | "brief"
// ... and all useState calls for: mode, threads, compareOpen, completion,
//     threadId, missionId, briefRef, textareaRef

// REPLACE with:
type ViewState = "idle" | "input" | "loading" | "verdict"

const [viewState, setViewState] = useState<ViewState>("idle")
const [idea, setIdea] = useState("")
const [verdict, setVerdict] = useState<V2Verdict | null>(null)
const [error, setError] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)
```

This will break many things. That's expected — Steps 3-7 will fix them.

### Step 3: Remove v1 Logic Blocks

Delete these code blocks from page.tsx:
- `getOwnerToken()` function
- `ShareBar` component
- `parsedBrief` useMemo
- `parsedConciseBrief` useMemo
- `parsedVerdict` useMemo (will be replaced by simpler state)
- `hasBrief` derived value
- All useEffects that reference deleted state
- `submitToMission` callback
- `handleIntakeComplete` callback
- Thread-related fetch in the initial useEffect

### Step 4: Write New Fetch Logic

Replace the streaming reader with a single JSON fetch:

```typescript
const handleSubmit = useCallback(async () => {
  if (!idea.trim() || idea.trim().length < 10 || isLoading) return

  setIsLoading(true)
  setError(null)
  setVerdict(null)
  setViewState("loading")

  try {
    const res = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: idea.trim() }),  // "idea" NOT "prompt"
    })

    const json = await res.json()

    if (!json.ok) {
      throw new Error(json.error?.message ?? "Request failed")
    }

    const result = v2VerdictSchema.safeParse(json.data)
    if (!result.success) {
      throw new Error("Invalid verdict format received")
    }

    setVerdict(result.data)
    setViewState("verdict")

    // Log meta for debugging (not shown to user)
    console.log("[verdict]", {
      verdict: result.data.verdict,
      confidence: result.data.confidence.score,
      duration_ms: json.meta?.duration_ms,
      cost_usd: json.meta?.cost_usd,
    })
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error")
    setViewState("input")  // Go back to input with error shown
  } finally {
    setIsLoading(false)
  }
}, [idea, isLoading])
```

### Step 5: Write New Render — Input State

Replace the old `intake`, `greeting`, and `classic` views with a single input view:

```tsx
{viewState === "input" && (
  <div className="flex-1 flex flex-col items-center pt-[10vh]">
    {/* Headline */}
    <h1 className="text-2xl font-bold tracking-tight mb-2">
      Fikrine dürüst cevap
    </h1>
    <p className="text-sm text-muted-foreground mb-8">
      10 saniye, 3 sebep, acımasızca dürüst.
    </p>

    {/* Input */}
    <div className="w-full max-w-xl">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div className="relative rounded-2xl border border-border/60 bg-card shadow-sm">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            rows={4}
            placeholder="Describe your idea..."
            className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
            disabled={isLoading}
            autoFocus
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <button
              type="submit"
              disabled={isLoading || idea.trim().length < 10}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-15 hover:opacity-80 transition-all"
            >
              Dürüst cevap al
            </button>
          </div>
        </div>
      </form>

      {/* Error inline */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
          {error}
          <button
            onClick={handleSubmit}
            className="ml-2 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/50 text-center mt-4 select-none">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  </div>
)}
```

### Step 6: Write New Render — Loading State

Calibrated for **17-33 second** real API response times:

```tsx
const LOADING_STEPS = [
  { delay: 0, text: "Reading your idea..." },
  { delay: 3000, text: "Checking the market..." },
  { delay: 8000, text: "Analyzing risks..." },
  { delay: 15000, text: "Building the verdict..." },
  { delay: 25000, text: "Deep analysis — complex ideas take longer..." },
]

// In component:
const [loadingStep, setLoadingStep] = useState(0)

useEffect(() => {
  if (viewState !== "loading") {
    setLoadingStep(0)
    return
  }
  const timers = LOADING_STEPS.map((step, i) =>
    setTimeout(() => setLoadingStep(i), step.delay)
  )
  return () => timers.forEach(clearTimeout)
}, [viewState])

// Render:
{viewState === "loading" && (
  <div className="flex-1 flex flex-col items-center justify-center">
    <CouncilMark className="w-8 h-8 text-foreground/60 mb-6 animate-pulse" />
    <div className="space-y-2 text-sm">
      {LOADING_STEPS.slice(0, loadingStep + 1).map((step, i) => (
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
  </div>
)}
```

### Step 7: Write New Render — Verdict State

```tsx
{viewState === "verdict" && verdict && (
  <div className="py-8">
    <VerdictCard verdict={verdict} missionId={null} />

    <div className="mt-6 text-center">
      <button
        onClick={() => {
          setIdea("")
          setVerdict(null)
          setError(null)
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

### Step 8: Initial State Resolution

Replace the old thread-fetching useEffect with a simple idle → input transition:

```tsx
useEffect(() => {
  // No thread check, no API call. Just show input.
  setViewState("input")
}, [])
```

### Step 9: Build & Test

```bash
npm run build  # Must pass
npm run dev    # Start dev server
# Run manual tests (see Manual Test Plan below)
```

---

## What NOT to Change

- ❌ `VerdictCard` component — it's done, don't touch it
- ❌ `src/app/api/verdict/route.ts` — Step 1 output, frozen
- ❌ `src/lib/agents/types.ts` — V2Verdict type is stable
- ❌ shadcn/ui components
- ❌ Tailwind config
- ❌ Dark mode / theme toggle
- ❌ Any v1 pages (`brief/[id]`, `thread/[id]`, etc.) — leave them
- ❌ Any v1 API routes (`/api/mission`, `/api/threads`, etc.) — leave them
- ❌ Any v1 component files — just remove imports from page.tsx, don't delete files

## What NOT to Build

- ❌ Streaming response handling (API returns single JSON)
- ❌ Roast mode toggle
- ❌ History / fikir günlüğü
- ❌ Thread system
- ❌ User authentication
- ❌ Email capture
- ❌ Feedback form (v2.1)
- ❌ Share image generation (OG image)
- ❌ Any new components in `src/components/ui/`
- ❌ Animated page transitions
- ❌ Elapsed time counter (nice-to-have, not now)
- ❌ useMinDisplayTime hook (overkill for 5 static steps)

---

## Acceptance Criteria

1. ✅ `page.tsx` has exactly 4 view states: `idle | input | loading | verdict`
2. ✅ No mode picker visible (verdict/full/concise/deep gone)
3. ✅ No `CouncilConversation`, `CouncilGreeting`, `CompareModal` imports
4. ✅ Input → submit → calls `POST /api/verdict` with `{ idea: string }` body (NOT `prompt`)
5. ✅ Loading state shows step-by-step progress hints (calibrated for 17-33s)
6. ✅ VerdictCard renders correctly with GO, PIVOT, and DONT verdicts
7. ✅ Error state shows message + retry inline
8. ✅ "Try another idea" button resets to input state
9. ✅ Enter-to-submit works (Shift+Enter for newline)
10. ✅ `npm run build` passes (tsc + eslint)
11. ✅ Mobile responsive (test at 375px width)
12. ✅ Dark mode works
13. ✅ `page.tsx` is under 250 lines (target: 150-200)

---

## Manual Test Plan

```bash
npm run dev
```

### Test 1: Happy Path (DONT verdict)

1. Open `http://localhost:3000`
2. See input form — no mode picker, no conversation, no greeting
3. Type: "Instagram clone yapmak istiyorum"
4. Press Enter
5. See loading steps appearing one by one
6. After ~17-33s, see VerdictCard with DONT
7. Click "Show evidence details" → drill-down opens
8. Click "Tweet" → Twitter intent opens
9. Click "Try another idea" → back to input

**Expected:** Verdict = DONT, confidence >= 85

### Test 2: Good Idea (GO verdict)

1. Type: "AI tool that reads legal contracts and highlights unfair clauses for freelancers"
2. Submit
3. See VerdictCard with GO

**Expected:** Verdict = GO, confidence >= 70

### Test 3: Error Recovery

1. Disconnect internet (or stop dev server)
2. Submit an idea
3. See error message inline
4. Reconnect / restart dev server
5. Click "Try again"
6. Verdict should load

### Test 4: Input Validation

1. Type "hi" (< 10 chars)
2. Submit button should be disabled
3. Type 10+ characters → button enables
4. Press Enter with < 10 chars → nothing happens

### Test 5: Dark Mode

1. Toggle dark mode in header
2. Check: input, loading, verdict, and error states all render correctly

### Test 6: Mobile (375px)

1. Chrome DevTools → toggle device toolbar → iPhone SE (375px)
2. Run through Test 1 flow
3. Verify nothing overflows, textarea is usable, verdict card fits

---

## Reporting Format

When done, paste this report **as a chat message**:

```markdown
## Implementation Report — Step 2

**File modified:** `src/app/page.tsx`
- Before: X lines
- After: Y lines
- Net reduction: Z lines

**Build status:** ✅ pass / ❌ fail

**Removed imports:** (check each)
- [ ] CouncilConversation
- [ ] CouncilGreeting
- [ ] CompareModal
- [ ] ShortcutHint
- [ ] BriefView
- [ ] ConciseBriefView
- [ ] strategicBriefSchema / conciseBriefSchema
- [ ] IntakeContext type

**Test results:**

### Test 1: Happy Path (DONT)
- Input shown (no mode picker): ✅/❌
- Loading steps visible: ✅/❌
- VerdictCard rendered: ✅/❌
- Verdict = DONT: ✅/❌
- Drill-down works: ✅/❌
- Tweet button works: ✅/❌
- "Try another idea" works: ✅/❌

### Test 2: Good Idea (GO)
- Verdict = GO: ✅/❌

### Test 3: Error Recovery
- Error shown: ✅/❌
- Retry works: ✅/❌

### Test 4: Input Validation
- Disabled under 10 chars: ✅/❌
- Enter blocked under 10 chars: ✅/❌

### Test 5: Dark Mode
- All states correct: ✅/❌

### Test 6: Mobile (375px)
- No overflow: ✅/❌
- Textarea usable: ✅/❌
- VerdictCard fits: ✅/❌

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
**Questions for prompt engineer:** [optional]
```

---

## Why This Spec Focuses on Removal

The v2 UX philosophy: **simplicity over features.**

The current `page.tsx` has ~420 lines with 6 view states, 3 brief parsers, a mode picker, thread management, conversation flow, and streaming logic. Most of this is v1 complexity that the v2 vision explicitly removed.

The goal is not "add new things." The goal is: **remove everything that isn't input → verdict.**

A simpler page is faster to load, easier to debug, and clearer for the user.

**Target:** `page.tsx` should end up at 150-200 lines. If it's longer, something wasn't removed that should have been.

---

## Claude Code Patterns Used in This Spec

| Pattern | Source | How Used |
|---------|--------|----------|
| Min display time | `src/hooks/useMinDisplayTime.ts` | Informed loading step design (opted for simpler setTimeout approach) |
| Error display | `FallbackToolUseErrorMessage.tsx` | Inspired inline error with truncation |
| State-driven errors | `TeleportError.tsx` | switch-case on error type for different messages |
| Elapsed time | `useElapsedTime.ts` | Deferred to v2.1 (nice-to-have) |
| Store pattern | `src/state/store.ts` | Overkill for 4 states — useState is sufficient |
