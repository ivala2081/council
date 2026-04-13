# Spec: v2 Step 9 — Multi-Round Memory (Delta Analysis)

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Steps 1-8 complete, feedback + history LIVE
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

When a user re-evaluates an idea, Council should remember the previous verdict and provide **delta analysis** — what changed, what improved, what's still a problem. This transforms Council from a one-shot tool into an iterative advisor.

**Current state:** "Re-evaluate" in history fills the textarea with the old idea text. User edits and submits. Council treats it as a brand-new idea — zero memory of the previous verdict.

**After this step:** When a user submits an idea that has a previous verdict in history, Council receives the previous verdict as context and produces a delta-aware analysis:

> "Last time I said PIVOT because you had no niche. Now you've added 'for freelancers' — that's a real wedge. Upgrading to GO."

**Architecture: Client-side context injection.** No database, no server-side session. The frontend detects "this idea has a previous verdict in history" and sends the previous verdict summary alongside the new idea in the API request. The LLM sees both and generates a delta-aware response.

---

## Critical Context

### 1. Files to Read FIRST

- [src/app/api/verdict/route.ts](src/app/api/verdict/route.ts) — ~758 lines. POST handler accepts `{ idea: string }`. The `callAnthropicWithTools` function builds the user message. **Modified: accept optional `previousVerdict` in request, inject into user message.**

- [src/app/page.tsx](src/app/page.tsx) — ~428 lines. `handleSubmit` sends `{ idea }` to API. History entries have `id`, `idea`, `verdict`, `confidence`, `ideaSummary`. **Modified: detect previous verdict from history, send alongside idea.**

- [src/lib/storage.ts](src/lib/storage.ts) — 74 lines. `HistoryEntry` type, `getHistory()` function. **Read-only — used to look up previous verdict.**

- [prompts/v2-system-prompt.json](prompts/v2-system-prompt.json) — System prompt. **NOT modified.** Delta instructions go in the user message, not the system prompt.

### 2. Why User Message, Not System Prompt

The system prompt is cached (`cache_control: "ephemeral"`) and shared across all requests. Adding delta context to the system prompt would:
- Break caching (different per request)
- Bloat every request even when there's no previous verdict

Instead: inject delta context into the **user message**. This keeps the system prompt cached and only adds tokens when relevant.

### 3. Previous Verdict Context Shape

When a previous verdict exists, we add this to the user message:

```
## PREVIOUS COUNCIL VERDICT (for comparison)

Idea submitted: "{previous idea text}"
Verdict: {GO|PIVOT|DONT}
Confidence: {score}%
Summary: "{ideaSummary}"

The user has now UPDATED their idea. Compare with the previous version and note what changed, what improved, and what still needs work. If the verdict changes, explain WHY.

## CURRENT IDEA (evaluate this)

{new idea text}
```

This is ~100-150 tokens of additional context. Cost impact: ~$0.0003/request. Negligible.

### 4. How to Detect "Re-evaluation"

A re-evaluation happens when:
1. User clicks "Re-evaluate" on a history entry → `handleReEvaluate` sets `idea` to the old idea text
2. User edits the text (or doesn't) and submits

We need to track **which history entry triggered the re-evaluation**. Add a `reEvalEntryRef` that stores the `HistoryEntry` when "Re-evaluate" is clicked, and clear it when "Try another idea" or a chip is clicked (fresh start).

**Similarity matching is NOT needed.** We don't fuzzy-match against all history. The connection is explicit: user clicked "Re-evaluate" → we know exactly which previous verdict to reference.

### 5. Claude Code Reference Patterns

**a) Context injection in user message:**
Pattern: Prepend context block to user message with clear section markers (`## PREVIOUS`, `## CURRENT`). The LLM treats these as structured input.

**b) Optional request body field:**
Pattern: Zod schema with `.optional()` field. Backend ignores if absent.

---

## Implementation Steps (Ordered)

### Step 0: Pre-Flight

1. Read all files from Critical Context
2. Run `npm run build` — confirm pass
3. No new dependencies

### Step 1: Update API Request Schema

In `src/app/api/verdict/route.ts`, update `RequestSchema`:

```typescript
const RequestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
  previousVerdict: z.object({
    idea: z.string(),
    verdict: z.enum(["GO", "PIVOT", "DONT"]),
    confidence: z.number(),
    ideaSummary: z.string(),
  }).optional(),
})
```

### Step 2: Update User Message Construction

In `callAnthropicWithTools`, change the function signature to accept optional previous verdict:

```typescript
async function callAnthropicWithTools(
  client: Anthropic,
  idea: string,
  previousVerdict?: {
    idea: string
    verdict: "GO" | "PIVOT" | "DONT"
    confidence: number
    ideaSummary: string
  },
): Promise<{ verdict: Verdict; usage: Anthropic.Messages.Usage }> {
```

Update the user message construction:

```typescript
let userMessage: string

if (previousVerdict) {
  userMessage =
    `## PREVIOUS COUNCIL VERDICT (for comparison)\n\n` +
    `Idea submitted: "${previousVerdict.idea}"\n` +
    `Verdict: ${previousVerdict.verdict}\n` +
    `Confidence: ${previousVerdict.confidence}%\n` +
    `Summary: "${previousVerdict.ideaSummary}"\n\n` +
    `The user has now UPDATED their idea. Compare with the previous version and note what changed, what improved, and what still needs work. If the verdict changes, explain WHY it changed.\n\n` +
    `## CURRENT IDEA (evaluate this)\n\n${idea}`
} else {
  userMessage = `Evaluate this idea and respond with valid JSON only:\n\n${idea}`
}

const messages: Anthropic.Messages.MessageParam[] = [
  { role: "user", content: userMessage },
]
```

### Step 3: Update POST Handler to Pass Previous Verdict

In the POST handler, pass `previousVerdict` through:

```typescript
const idea = stripHtml(parsed.data.idea);
if (idea.length < 10) {
  return errorResponse("INVALID_INPUT", "Idea too short after sanitization", 400);
}

// Call Anthropic with tool-use loop
let verdict: Verdict;
let usage: Anthropic.Messages.Usage;
try {
  const client = new Anthropic();
  const result = await callAnthropicWithTools(client, idea, parsed.data.previousVerdict);
  verdict = result.verdict;
  usage = result.usage;
} catch (err) {
  return handleAnthropicError(err);
}
```

### Step 4: Update Frontend — Track Re-evaluation Source

In `src/app/page.tsx`:

1. Add a ref to track which history entry is being re-evaluated:

```typescript
const reEvalEntryRef = useRef<HistoryEntry | null>(null)
```

2. Update `handleReEvaluate` to store the entry:

```typescript
const handleReEvaluate = (entry: HistoryEntry) => {
  reEvalEntryRef.current = entry  // remember which entry we're re-evaluating
  setIdea(entry.idea)
  setVerdict(null)
  setError(null)
  setViewState("input")
}
```

3. Clear the ref when starting fresh (chip click, "Try another idea", or typing a completely new idea):

In the "Try another idea" handler:
```typescript
reEvalEntryRef.current = null
```

In each chip click handler, clear it:
```typescript
onClick={() => { setIdea(ex.text); reEvalEntryRef.current = null }}
```

### Step 5: Update Frontend — Send Previous Verdict in Request

In `handleSubmit`, modify the fetch body to include previous verdict when re-evaluating:

```typescript
const fetchBody: Record<string, unknown> = { idea: idea.trim() }

if (reEvalEntryRef.current) {
  fetchBody.previousVerdict = {
    idea: reEvalEntryRef.current.idea,
    verdict: reEvalEntryRef.current.verdict,
    confidence: reEvalEntryRef.current.confidence,
    ideaSummary: reEvalEntryRef.current.ideaSummary,
  }
}

const res = await fetch("/api/verdict", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(fetchBody),
})
```

After the verdict is received and saved to history, clear the ref:
```typescript
reEvalEntryRef.current = null
```

### Step 6: Add i18n Strings

In `src/lib/i18n.tsx`, add:

```typescript
// -- Re-evaluation --
re_eval_badge: {
  en: "Re-evaluation",
  tr: "Tekrar değerlendirme",
},
re_eval_previous: {
  en: "Previous verdict",
  tr: "Önceki karar",
},
```

### Step 7: Add Re-evaluation Badge to UI

In `src/app/page.tsx`, inside the verdict view section (above "Council heard" header), show a small badge when this was a re-evaluation:

```tsx
{viewState === "verdict" && verdict && (
  <div className="py-8">
    {/* Re-evaluation badge (only if this was a re-eval) */}
    {reEvalEntryRef.current && (
      <div className="max-w-xl mx-auto mb-3 px-1">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          {t("re_eval_badge")} · {t("re_eval_previous")}: {reEvalEntryRef.current.verdict} ({reEvalEntryRef.current.confidence}%)
        </div>
      </div>
    )}

    {/* Council heard header */}
    ...
```

**Note:** `reEvalEntryRef.current` is a ref, not state — it won't trigger a re-render on its own. But it's read during the render that happens when `setViewState("verdict")` fires, so it will be displayed correctly. Clear it AFTER the verdict is saved to history (in handleSubmit, after `addToHistory`).

**IMPORTANT:** Move the `reEvalEntryRef.current = null` to AFTER the history save and AFTER the render, to ensure the badge is visible. Use a microtask:

```typescript
// After addToHistory and setHistory:
setTimeout(() => { reEvalEntryRef.current = null }, 0)
```

Or simply don't clear it until the user navigates away (clicks "Try another idea" or submits again). This is simpler and the badge disappears naturally when viewState changes.

**Simplest approach:** Don't clear the ref in handleSubmit at all. Only clear it in "Try another idea" and chip clicks. The ref persists during verdict view (badge visible) and gets cleared on next navigation.

### Step 8: Build & Test

```bash
npm run build
npm run dev
```

---

## What NOT to Build

- ❌ Server-side session management
- ❌ Database for verdict history chain
- ❌ Fuzzy matching / similarity detection of ideas against history
- ❌ Multi-verdict comparison (only 1 previous verdict, not a chain of 5)
- ❌ Automatic re-evaluation scheduling
- ❌ Changes to system prompt
- ❌ Changes to verdict schema (no new "delta" fields — the LLM incorporates delta into its existing reasons)
- ❌ Visual diff of old vs new verdict
- ❌ History entry linking / threading
- ❌ New dependencies

## What NOT to Change

- ❌ System prompt (`prompts/v2-system-prompt.json`)
- ❌ VerdictSchema / output schema
- ❌ `verdict-card.tsx` (no changes needed — verdict renders normally)
- ❌ `storage.ts` data shapes (HistoryEntry stays the same)
- ❌ Share functionality (`/v/[id]`, OG images)
- ❌ Feedback widget

---

## Acceptance Criteria

1. ✅ API accepts optional `previousVerdict` in request body
2. ✅ When `previousVerdict` is present, user message includes "PREVIOUS COUNCIL VERDICT" context block
3. ✅ When absent, user message is unchanged (backward compatible)
4. ✅ "Re-evaluate" from history stores the entry in `reEvalEntryRef`
5. ✅ Re-evaluation request sends `previousVerdict` to API
6. ✅ LLM response references the previous verdict in its reasons (e.g., "previously PIVOT, now GO because...")
7. ✅ Re-evaluation badge visible above "Council heard" header
8. ✅ Badge shows previous verdict + confidence
9. ✅ "Try another idea" clears the re-eval ref (no stale context)
10. ✅ Chip clicks clear the re-eval ref
11. ✅ Fresh submissions (no re-eval) work exactly as before
12. ✅ No new dependencies
13. ✅ `npm run build` passes
14. ✅ Bilingual (badge strings use `t()`)
15. ✅ Dark mode works (badge uses semantic tokens)

---

## Manual Test Plan

### Test 1: Fresh Submission (No Memory — Backward Compat)

1. Open localhost:3000
2. Type a new idea manually (don't click Re-evaluate)
3. Submit

**Expected:**
- Normal verdict, no re-eval badge
- Console log shows no `previousVerdict` in request
- Identical to pre-Step 9 behavior

### Test 2: Re-evaluate Flow (Happy Path)

1. Submit: "Online terapi platformu"
2. Wait for verdict (expect PIVOT or DONT)
3. Click "Try another idea"
4. In history, click "Re-evaluate" on the entry you just created
5. Edit the idea to: "Online terapi platformu — sadece ergenler için, okul psikologlarıyla ortaklık"
6. Submit

**Expected:**
- Re-evaluation badge visible above "Council heard" header: "Re-evaluation · Previous verdict: PIVOT (72%)"
- Verdict reasons reference the previous version: mentions niche improvement, segment focus
- Verdict may change (PIVOT → GO) or stay same with different confidence
- New entry added to history

### Test 3: Re-evaluate Without Editing

1. Submit any idea
2. Click "Try another idea" → Re-evaluate the same entry
3. Submit WITHOUT changing the text

**Expected:**
- Still works (same idea re-evaluated with memory of previous)
- LLM may give same or different verdict (non-deterministic)
- No crash, no error

### Test 4: Chip Click After Re-evaluate Clears Context

1. Click "Re-evaluate" on a history entry (textarea fills)
2. Instead of submitting, click a chip (e.g., "Instagram clone")
3. Submit the chip idea

**Expected:**
- No re-eval badge in verdict (ref was cleared by chip click)
- Normal fresh submission

### Test 5: "Try Another Idea" Clears Context

1. Get a verdict via re-evaluation (badge visible)
2. Click "Try another idea"
3. Submit a completely new idea

**Expected:**
- No re-eval badge
- Fresh verdict with no previous context

### Test 6: API Direct Test — With Previous Verdict

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{
    "idea": "Online terapi platformu — sadece ergenler için, okul psikologlarıyla ortaklık modeli",
    "previousVerdict": {
      "idea": "Online terapi platformu",
      "verdict": "PIVOT",
      "confidence": 72,
      "ideaSummary": "Genel online terapi platformu"
    }
  }'
```

**Expected:**
- HTTP 200
- Verdict reasons reference the previous PIVOT verdict
- May mention "niche improvement" or "segment focus"

### Test 7: API Direct Test — Without Previous Verdict (Backward Compat)

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"AI tool that reads legal contracts for freelancers"}'
```

**Expected:**
- HTTP 200
- Normal verdict, no delta analysis
- Identical to pre-Step 9 behavior

### Test 8: API Direct Test — Invalid Previous Verdict Shape

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{
    "idea": "Some valid idea here",
    "previousVerdict": { "garbage": true }
  }'
```

**Expected:**
- HTTP 400 — `INVALID_INPUT` (Zod rejects malformed previousVerdict)

### Test 9: Bilingual Badge

1. Switch to TR
2. Do a re-evaluation flow
3. **Expected:** Badge text: "Tekrar değerlendirme · Önceki karar: PIVOT (72%)"

### Test 10: Dark Mode

1. Re-evaluation badge in dark mode
2. **Expected:** `bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400` — visible and readable

---

## Reporting Format

```markdown
## Implementation Report — Step 9

**Files modified:**
- `src/app/api/verdict/route.ts` (before: X lines, after: Y lines — RequestSchema + callAnthropicWithTools signature + POST handler)
- `src/app/page.tsx` (before: X lines, after: Y lines — reEvalEntryRef + handleReEvaluate + fetchBody + badge)
- `src/lib/i18n.tsx` (added 2 strings)

**Dependencies added:** none

**Build status:** ✅ pass / ❌ fail

**Test results:**

### Test 1 (fresh submission, backward compat): ✅/❌
### Test 2 (re-evaluate happy path): ✅/❌
- Previous verdict referenced in reasons: ✅/❌
- Badge visible: ✅/❌
- Paste one reason that mentions previous verdict: "..."
### Test 3 (re-evaluate without editing): ✅/❌
### Test 4 (chip click clears context): ✅/❌
### Test 5 (try another clears context): ✅/❌
### Test 6 (API with previousVerdict): ✅/❌
- Paste one delta-aware reason: "..."
### Test 7 (API without previousVerdict): ✅/❌
### Test 8 (invalid previousVerdict → 400): ✅/❌
### Test 9 (bilingual badge): ✅/❌
### Test 10 (dark mode): ✅/❌

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
**Questions for prompt engineer:** [optional]
```

---

## Why Client-Side Context, Not Server-Side Session

| Aspect | Server session | Client context injection |
|---|---|---|
| Infrastructure | Needs session store (Redis/DB) | Zero |
| Privacy | Server stores conversation | Nothing stored on server |
| Latency | Session lookup per request | Zero overhead |
| Complexity | Session ID management, TTL, cleanup | One optional field in request body |
| Token cost | Same (previous verdict injected either way) | Same |
| Multi-device | Shared | Per-device (matches localStorage history) |

The previous verdict is already in the client's localStorage (from Step 8 history). Sending it back to the API is ~100 tokens. No infrastructure needed.

If we later want server-side conversation threads (like ChatGPT), we add a session layer ON TOP of this. The client-side injection pattern stays valid as the fast path.
