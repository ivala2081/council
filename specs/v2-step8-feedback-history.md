# Spec: v2 Step 8 — Feedback Widget + Verdict History

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Steps 1-7 complete, shareable verdicts with OG images LIVE
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Add two features that close the user feedback loop and build retention:

**Item A — Feedback Widget:** After each verdict, let users rate with thumbs up/down + optional one-line comment. Stored in localStorage. No backend — pure client-side sentiment data that can be shipped to analytics later.

**Item B — Verdict History (Fikir Günlüğü):** Every verdict is automatically saved to localStorage. Users see their past verdicts on the input page. Can re-evaluate an old idea or view a past verdict. Max 20 entries, newest first.

Both features use **localStorage only** — zero backend changes, zero API changes, zero database.

---

## Critical Context

### 1. Files to Read FIRST

- [src/app/page.tsx](src/app/page.tsx) — ~320 lines. Contains verdict state, `handleSubmit`, input/loading/verdict views. **Modified for both items.**

- [src/components/verdict-card.tsx](src/components/verdict-card.tsx) — ~331 lines. Contains share bar at the bottom. **Modified for Item A (feedback below share bar).**

- [src/lib/i18n.tsx](src/lib/i18n.tsx) — Dictionary. **Modified (add ~15 new strings).**

- [src/lib/verdict-share.ts](src/lib/verdict-share.ts) — `encodeVerdict`, `ShareableVerdict`. **Read-only — used by history to store encoded verdict IDs.**

### 2. localStorage Keys

| Key | Type | Purpose |
|---|---|---|
| `council-lang` | `"en" \| "tr"` | Already exists — UI language |
| `council_theme` | `"dark" \| "light"` | Already exists — theme |
| `council-feedback` | `FeedbackEntry[]` | NEW — feedback ratings |
| `council-history` | `HistoryEntry[]` | NEW — past verdicts |

### 3. Data Shapes

```typescript
// Item A — Feedback
interface FeedbackEntry {
  verdictId: string       // encoded verdict ID (from encodeVerdict)
  rating: "up" | "down"
  comment?: string        // optional one-liner
  timestamp: number       // Date.now()
}

// Item B — History
interface HistoryEntry {
  id: string              // encoded verdict ID (for shareable link)
  idea: string            // original user input (first 100 chars)
  verdict: "GO" | "PIVOT" | "DONT"
  confidence: number
  ideaSummary: string     // from verdict response
  timestamp: number       // Date.now()
}
```

### 4. Claude Code Reference Patterns

**a) localStorage wrapper:**
Standard pattern: read JSON from localStorage, parse with fallback, write back after mutation. Wrap in try/catch (private browsing may throw).

**b) List with max entries:**
Pattern: `array.unshift(newItem)` + `array.slice(0, MAX)` — newest first, bounded.

---

## Implementation Steps (Ordered)

### Step 0: Pre-Flight

1. Read all files from Critical Context
2. Run `npm run build` — confirm pass
3. No new dependencies needed

### Step 1: Add i18n Strings

Add these entries to `src/lib/i18n.tsx` dictionary (before `} as const`):

```typescript
// -- Feedback --
feedback_helpful: {
  en: "Was this helpful?",
  tr: "Bu faydalı oldu mu?",
},
feedback_thanks: {
  en: "Thanks for the feedback!",
  tr: "Geri bildirim için teşekkürler!",
},
feedback_comment_placeholder: {
  en: "Any thoughts? (optional)",
  tr: "Düşüncen var mı? (isteğe bağlı)",
},
feedback_send: {
  en: "Send",
  tr: "Gönder",
},

// -- History --
history_title: {
  en: "Your past verdicts",
  tr: "Geçmiş kararların",
},
history_empty: {
  en: "No verdicts yet",
  tr: "Henüz karar yok",
},
history_re_evaluate: {
  en: "Re-evaluate",
  tr: "Tekrar değerlendir",
},
history_view: {
  en: "View",
  tr: "Görüntüle",
},
history_clear: {
  en: "Clear history",
  tr: "Geçmişi temizle",
},
history_clear_confirm: {
  en: "Are you sure?",
  tr: "Emin misin?",
},
history_ago: {
  en: "ago",
  tr: "önce",
},
```

### Step 2: Create localStorage Helpers

Create `src/lib/storage.ts`:

```typescript
// ============================================================
// localStorage helpers — typed, safe, bounded
// ============================================================

export interface FeedbackEntry {
  verdictId: string
  rating: "up" | "down"
  comment?: string
  timestamp: number
}

export interface HistoryEntry {
  id: string              // encoded verdict ID
  idea: string            // user's original input (first 100 chars)
  verdict: "GO" | "PIVOT" | "DONT"
  confidence: number
  ideaSummary: string
  timestamp: number
}

const FEEDBACK_KEY = "council-feedback"
const HISTORY_KEY = "council-history"
const MAX_HISTORY = 20

function readJSON<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeJSON<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Private browsing or quota exceeded — silently fail
  }
}

// ---- Feedback ----

export function saveFeedback(entry: FeedbackEntry): void {
  const items = readJSON<FeedbackEntry>(FEEDBACK_KEY)
  // Replace if same verdictId exists (user changed their mind)
  const filtered = items.filter(f => f.verdictId !== entry.verdictId)
  filtered.unshift(entry)
  writeJSON(FEEDBACK_KEY, filtered)
}

export function getFeedback(verdictId: string): FeedbackEntry | null {
  const items = readJSON<FeedbackEntry>(FEEDBACK_KEY)
  return items.find(f => f.verdictId === verdictId) ?? null
}

// ---- History ----

export function addToHistory(entry: HistoryEntry): void {
  const items = readJSON<HistoryEntry>(HISTORY_KEY)
  // Prevent duplicates (same encoded ID)
  const filtered = items.filter(h => h.id !== entry.id)
  filtered.unshift(entry)
  writeJSON(HISTORY_KEY, filtered.slice(0, MAX_HISTORY))
}

export function getHistory(): HistoryEntry[] {
  return readJSON<HistoryEntry>(HISTORY_KEY)
}

export function clearHistory(): void {
  writeJSON(HISTORY_KEY, [])
}
```

### Step 3: Item A — Add Feedback Widget to VerdictCard

In `src/components/verdict-card.tsx`:

1. Add imports:
```typescript
import { saveFeedback, getFeedback } from "@/lib/storage"
```

2. Add `verdictId` to props (should already exist from Step 7):
```typescript
interface VerdictCardProps {
  verdict: V2Verdict
  missionId?: string | null
  verdictId?: string | null
}
```

3. Add feedback state inside VerdictCard component:
```typescript
const [feedbackState, setFeedbackState] = useState<"idle" | "rated" | "commenting" | "done">("idle")
const [feedbackRating, setFeedbackRating] = useState<"up" | "down" | null>(null)
const [feedbackComment, setFeedbackComment] = useState("")

// Check if already rated
useEffect(() => {
  if (!verdictId) return
  const existing = getFeedback(verdictId)
  if (existing) {
    setFeedbackRating(existing.rating)
    setFeedbackState("done")
  }
}, [verdictId])

const handleFeedback = (rating: "up" | "down") => {
  setFeedbackRating(rating)
  setFeedbackState("commenting")
}

const submitFeedback = () => {
  if (!verdictId || !feedbackRating) return
  saveFeedback({
    verdictId,
    rating: feedbackRating,
    comment: feedbackComment.trim() || undefined,
    timestamp: Date.now(),
  })
  setFeedbackState("done")
}
```

4. Add feedback UI **below the share bar** (after the existing share `<div>`):

```tsx
{/* Feedback widget */}
{verdictId && (
  <div className="pt-2">
    {feedbackState === "idle" && (
      <div className="flex items-center justify-center gap-3">
        <span className="text-[11px] text-muted-foreground/60">{t("feedback_helpful")}</span>
        <button
          onClick={() => handleFeedback("up")}
          className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0H22.5a2.25 2.25 0 0 1 0 4.5h-.667c.336.364.53.853.53 1.384 0 .843-.502 1.567-1.222 1.896.362.462.566 1.045.566 1.673 0 .758-.345 1.436-.886 1.884.252.404.397.883.397 1.394 0 1.489-1.198 2.696-2.677 2.696H12.62c-.547 0-1.085-.124-1.576-.362-.89-.432-1.906-.652-2.943-.652H6.632m0-6.75h.77c1.354 0 2.59-.84 3.245-2.01a6.013 6.013 0 0 1 .552-.834" />
          </svg>
        </button>
        <button
          onClick={() => handleFeedback("down")}
          className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/30 transition-colors text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.861-2.4c.498-.634 1.226-1.08 2.032-1.08h.384" />
          </svg>
        </button>
      </div>
    )}

    {feedbackState === "commenting" && (
      <div className="flex items-center gap-2 max-w-md mx-auto">
        <input
          type="text"
          value={feedbackComment}
          onChange={(e) => setFeedbackComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitFeedback() }}
          placeholder={t("feedback_comment_placeholder")}
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-border/60 bg-transparent placeholder:text-muted-foreground/40 focus:outline-none"
          autoFocus
          maxLength={200}
        />
        <button
          onClick={submitFeedback}
          className="text-xs px-3 py-2 rounded-lg bg-foreground text-background font-medium hover:opacity-80 transition-all"
        >
          {t("feedback_send")}
        </button>
      </div>
    )}

    {feedbackState === "done" && (
      <p className="text-center text-[11px] text-muted-foreground/60">
        {feedbackRating === "up" ? "👍" : "👎"} {t("feedback_thanks")}
      </p>
    )}
  </div>
)}
```

### Step 4: Item B — Add History to page.tsx

In `src/app/page.tsx`:

1. Add imports:
```typescript
import { addToHistory, getHistory, clearHistory, type HistoryEntry } from "@/lib/storage"
```

2. Add state:
```typescript
const [history, setHistory] = useState<HistoryEntry[]>([])
const [showClearConfirm, setShowClearConfirm] = useState(false)
```

3. Load history on mount (add to the existing idle→input useEffect):
```typescript
useEffect(() => {
  setViewState("input")
  setHistory(getHistory())
}, [])
```

4. After setting verdict in handleSubmit (after `setVerdictId(encodeVerdict(shareable))`), save to history:
```typescript
// Save to history
const historyEntry: HistoryEntry = {
  id: encodeVerdict(shareable),
  idea: idea.trim().slice(0, 100),
  verdict: result.data.verdict,
  confidence: result.data.confidence.score,
  ideaSummary: result.data.idea_summary,
  timestamp: Date.now(),
}
addToHistory(historyEntry)
setHistory(getHistory())  // refresh list
```

5. Add a `handleReEvaluate` function:
```typescript
const handleReEvaluate = (entry: HistoryEntry) => {
  setIdea(entry.idea)
  setVerdict(null)
  setError(null)
  setViewState("input")
}
```

6. Add history section to the **input view**, BELOW the chips and BELOW the error block, ABOVE the "Enter to send" hint:

```tsx
{/* Verdict history */}
{history.length > 0 && idea.trim().length === 0 && (
  <div className="mt-6 border-t border-border/30 pt-4">
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("history_title")}
      </p>
      {showClearConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/60">{t("history_clear_confirm")}</span>
          <button
            onClick={() => { clearHistory(); setHistory([]); setShowClearConfirm(false) }}
            className="text-[11px] text-red-500 hover:text-red-400"
          >
            ✓
          </button>
          <button
            onClick={() => setShowClearConfirm(false)}
            className="text-[11px] text-muted-foreground"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowClearConfirm(true)}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {t("history_clear")}
        </button>
      )}
    </div>
    <div className="space-y-2">
      {history.slice(0, 5).map((entry) => {
        const badge = entry.verdict === "GO"
          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          : entry.verdict === "PIVOT"
            ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
            : "text-red-600 dark:text-red-400 bg-red-500/10"
        const timeAgo = formatTimeAgo(entry.timestamp)

        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-card/50 hover:bg-muted/30 transition-colors group"
          >
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge} shrink-0`}>
              {entry.verdict === "DONT" ? "DON'T" : entry.verdict}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground truncate">{entry.ideaSummary}</p>
              <p className="text-[10px] text-muted-foreground/50">{entry.confidence}% · {timeAgo}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={`/v/${entry.id}`}
                className="text-[10px] px-2 py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("history_view")}
              </a>
              <button
                onClick={() => handleReEvaluate(entry)}
                className="text-[10px] px-2 py-1 rounded border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("history_re_evaluate")}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}
```

7. Add `formatTimeAgo` helper at the top of the file (above the component, below imports):

```typescript
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "<1m"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
```

### Step 5: Build & Test

```bash
npm run build
npm run dev
```

---

## What NOT to Build

- ❌ Backend API for feedback (no `/api/feedback` calls — localStorage only)
- ❌ Supabase writes for history
- ❌ Analytics dashboard for feedback data
- ❌ Detailed feedback form (star ratings, multi-question survey)
- ❌ History pagination (show max 5 recent on input page, that's enough)
- ❌ History search or filter
- ❌ History export (JSON download, CSV)
- ❌ History sync across devices
- ❌ Undo/delete individual history entries
- ❌ Feedback on shared verdict page (only on original verdict)
- ❌ New API routes
- ❌ Changes to system prompt or verdict schema

## What NOT to Change

- ❌ API route (`src/app/api/verdict/route.ts`)
- ❌ System prompt
- ❌ VerdictSchema
- ❌ Share page (`/v/[id]`)
- ❌ OG image
- ❌ Existing share/tweet functionality (only ADD feedback below it)

---

## Acceptance Criteria

### Item A — Feedback Widget
1. ✅ Thumbs up/down buttons appear below share bar after verdict
2. ✅ Clicking thumb shows optional comment input
3. ✅ Submitting (or pressing Enter on empty comment) saves to localStorage
4. ✅ "Thanks for the feedback!" confirmation replaces the widget
5. ✅ Re-viewing same verdict shows already-rated state ("done")
6. ✅ Feedback persists across page reload

### Item B — Verdict History
7. ✅ Every verdict automatically saved to `council-history` localStorage
8. ✅ History section appears on input page when `idea` is empty AND history exists
9. ✅ Shows max 5 most recent entries with verdict badge, summary, confidence, time ago
10. ✅ "View" link opens `/v/[id]` in same tab
11. ✅ "Re-evaluate" button fills textarea with original idea, goes to input state
12. ✅ "Clear history" with confirmation prompt works
13. ✅ Max 20 entries stored (FIFO)
14. ✅ History hidden when user starts typing (same condition as chips)

### General
15. ✅ No new dependencies
16. ✅ No API changes
17. ✅ `npm run build` passes
18. ✅ Bilingual (all new strings use `t()`)
19. ✅ Dark mode works
20. ✅ Mobile (375px) — feedback buttons and history entries fit

---

## Manual Test Plan

### Test 1: Feedback — Happy Path

1. Submit any idea, wait for verdict
2. Below share bar, see "Was this helpful?" + thumbs up/down
3. Click thumbs up
4. See optional comment input appear
5. Type "Great analysis!" and press Enter (or click Send)
6. See "👍 Thanks for the feedback!" message

**Expected:** Feedback saved. Check: `JSON.parse(localStorage.getItem('council-feedback'))` in console.

### Test 2: Feedback — Thumbs Down + Skip Comment

1. Submit another idea, get verdict
2. Click thumbs down
3. Don't type anything, click Send (or press Enter on empty)
4. See "👎 Thanks for the feedback!"

**Expected:** Saved with `rating: "down"`, no `comment` field.

### Test 3: Feedback — Persistence

1. After rating a verdict, click "Try another idea"
2. Submit the SAME idea again (or navigate back)
3. If same verdictId, feedback widget should show "done" state immediately

**Expected:** `getFeedback(verdictId)` returns existing entry, widget shows 👍/👎 + thanks.

### Test 4: History — Auto-Save

1. Submit: "Instagram clone yapmak istiyorum"
2. After verdict, click "Try another idea"
3. On input page, see history section below chips
4. First entry shows: DON'T badge, idea summary, confidence %, time ago

**Expected:** History section visible with 1 entry.

### Test 5: History — Multiple Entries

1. Submit 3 different ideas (any ideas)
2. After each verdict, click "Try another idea"
3. Input page should show 3 entries, newest first

**Expected:** 3 entries in reverse chronological order.

### Test 6: History — Re-evaluate

1. From history, click "Re-evaluate" on any entry
2. **Expected:** Textarea fills with original idea text, chips disappear, ready to submit

### Test 7: History — View

1. From history, click "View" on any entry
2. **Expected:** Opens `/v/[id]` page showing the shared verdict card

### Test 8: History — Clear

1. Click "Clear history"
2. See confirmation: "Are you sure?" with ✓ and ✕
3. Click ✓
4. **Expected:** History section disappears, localStorage `council-history` is `[]`

### Test 9: History — Hidden While Typing

1. With history visible, start typing in textarea
2. **Expected:** History section disappears (same condition as chips: `idea.trim().length === 0`)

### Test 10: History — Max 20 Entries

1. In browser console: fill localStorage with 25 fake entries
2. Submit a new idea
3. Check `localStorage.getItem('council-history')`
4. **Expected:** Only 20 entries (oldest 5 trimmed)

### Test 11: Bilingual — All New Strings

1. Switch to TR
2. Check feedback: "Bu faydalı oldu mu?", "Geri bildirim için teşekkürler!", "Düşüncen var mı?"
3. Check history: "Geçmiş kararların", "Tekrar değerlendir", "Görüntüle", "Geçmişi temizle"

### Test 12: Dark Mode + Mobile

1. Toggle dark mode — check feedback widget and history rendering
2. iPhone SE (375px) — check history entries fit, buttons don't overflow
3. **Expected:** All semantic tokens, no overflow

---

## Reporting Format

```markdown
## Implementation Report — Step 8

**Files created:**
- `src/lib/storage.ts` (X lines)

**Files modified:**
- `src/app/page.tsx` (before: X lines, after: Y lines)
- `src/components/verdict-card.tsx` (before: X lines, after: Y lines)
- `src/lib/i18n.tsx` (added X strings)

**Dependencies added:** none

**Build status:** ✅ pass / ❌ fail

**Test results:**

### Item A — Feedback
- Test 1 (thumbs up + comment): ✅/❌
- Test 2 (thumbs down, no comment): ✅/❌
- Test 3 (persistence): ✅/❌

### Item B — History
- Test 4 (auto-save): ✅/❌
- Test 5 (multiple entries): ✅/❌
- Test 6 (re-evaluate): ✅/❌
- Test 7 (view): ✅/❌
- Test 8 (clear): ✅/❌
- Test 9 (hidden while typing): ✅/❌
- Test 10 (max 20): ✅/❌

### General
- Test 11 (bilingual): ✅/❌
- Test 12 (dark mode + mobile): ✅/❌

**localStorage sample (feedback):** [paste one entry]
**localStorage sample (history):** [paste one entry]

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
**Questions for prompt engineer:** [optional]
```

---

## Why localStorage, Not Supabase

| Aspect | Supabase | localStorage |
|---|---|---|
| Latency | 50-200ms per write | <1ms |
| Privacy | Data on server | Data on user's device |
| Cross-device | Synced | Per-device only |
| Dependency | Needs env vars + DB running | Zero |
| Quota | Unlimited | ~5MB per origin |
| Data loss | Server crash | Browser clear |

For MVP with < 100 users: localStorage wins. When we need cross-device sync or aggregate analytics, add Supabase writes as an OPTIONAL enhancement layer — localStorage stays as the primary fast path.

20 verdicts × ~500 bytes each = ~10KB. Well within the 5MB localStorage limit.
