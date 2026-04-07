# Spec: v2 Verdict API Route

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 2.0 (revised after 15-item review)
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** v2 prompt validated (20/20 on golden tests, 2026-04-06)
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Build a single API endpoint that takes an idea and returns a structured verdict.

This is the **only thing** the v2 backend needs to do for the MVP. No multi-phase orchestration, no streaming agents, no Agent-Reach. Just: idea in → verdict out.

---

## Critical Context (Read This First)

You are working in a Next.js 16 App Router project. Before writing any code, you MUST understand:

1. **Anthropic SDK version:** `@anthropic-ai/sdk@^0.78.0` (already in `package.json`). Use the syntax that matches this version. Do NOT upgrade.

2. **The v1 reference dispatcher:** [src/lib/orchestrator/dispatcher.ts:199-271](src/lib/orchestrator/dispatcher.ts#L199-L271) shows the exact `messages.create` call pattern this codebase uses, including `cache_control` placement and JSON extraction. **Read this file before writing your route.** Steal the patterns. Don't reinvent.

3. **The v1 pricing config:** [src/lib/optimization/config.ts:24-51](src/lib/optimization/config.ts#L24-L51) defines `ANTHROPIC_PRICING`. **Use this** for cost calculation — do NOT hardcode prices.

4. **The v2 prompt model ID:** `prompts/v2-system-prompt.json` declares `claude-sonnet-4-6` as the model. **Check whether this model ID exists in `ANTHROPIC_PRICING`.** If not, you must add an entry to `config.ts` with the correct prices BEFORE starting:
   ```typescript
   "claude-sonnet-4-6": {
     inputPerMillion: 3.0,
     outputPerMillion: 15.0,
     cacheWritePerMillion: 3.75,
     cacheReadPerMillion: 0.30,
   }
   ```
   This is the ONLY edit allowed to `config.ts`.

5. **The verdict schema source of truth:** `prompts/v2-output-schema.json` has a field called `zod_typescript` containing copy-paste-ready Zod code. Use that, do NOT hand-write Zod from the JSON schema.

---

## File to Create

```
src/app/api/verdict/route.ts
```

Plus, if needed (see Critical Context #4):

```
src/lib/optimization/config.ts   (single-line addition only)
```

That's it. No helper directories. No `src/lib/verdict/...`. No abstraction layers. One route file.

---

## Endpoint Contract

### Request

```
POST /api/verdict
Content-Type: application/json

{
  "idea": "string (min 10, max 2000 chars)"
}
```

Note: `userToken` field removed from spec v2 — see Rate Limiting section below for why.

### Response (Success)

```
200 OK
Content-Type: application/json

{
  "ok": true,
  "data": { /* full Verdict object matching VerdictSchema */ },
  "meta": {
    "model": "claude-sonnet-4-6",
    "duration_ms": 4523,
    "tokens": {
      "input": 1234,
      "output": 567,
      "cache_read": 1100,
      "cache_write": 0
    },
    "cost_usd": 0.0089
  }
}
```

**Why `data` not `verdict`:** The Verdict schema itself has a field called `verdict` (the GO/PIVOT/DONT enum). Using `verdict` at the top level too would create `result.verdict.verdict === "GO"` — confusing and ambiguous. Use `data` for the wrapper.

### Response (Error)

```
4xx/5xx
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT" | "API_OVERLOAD" | "VALIDATION_FAILED" | "TIMEOUT" | "INTERNAL",
    "message": "human-readable error",
    "retry_after_ms": 5000  // optional, only for API_OVERLOAD
  }
}
```

Both response shapes are validated against a Zod schema (`ApiResponseSchema`) before returning. This catches accidental shape drift.

---

## Implementation Steps

### Step 0: Pre-Flight Check

Before writing the route file, do these:

1. Open `src/lib/optimization/config.ts`. Find `ANTHROPIC_PRICING`. Check if `claude-sonnet-4-6` exists as a key.
2. If NOT, add the entry shown in Critical Context #4. Save the file. Run `npm run build` to confirm no TS errors.
3. Open `src/lib/orchestrator/dispatcher.ts`. Read lines 199-271. This is your reference implementation.
4. Open `prompts/v2-output-schema.json`. Find `zod_typescript` field. Copy its value (it's a string of TypeScript code). You'll paste this into your route file in Step 2.

### Step 1: Module-Level Setup

At the top of `src/app/api/verdict/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import promptConfig from '@/../prompts/v2-system-prompt.json'
import { ANTHROPIC_PRICING } from '@/lib/optimization/config'

// Force Node.js runtime (not edge) — Anthropic SDK requires it
export const runtime = 'nodejs'

// Disable Next.js caching for this route — verdicts are non-idempotent
export const dynamic = 'force-dynamic'
```

**Why `runtime = 'nodejs'`:** The Anthropic SDK uses Node.js APIs (streams, http) that aren't available in edge runtime. Specifying this prevents Vercel from accidentally deploying to edge.

**Why `dynamic = 'force-dynamic'`:** Next.js may try to statically optimize POST routes in some configurations. Force dynamic to prevent surprises.

**Why JSON imports work:** Next.js 16 supports JSON imports natively. The file is parsed at build time and embedded in the bundle. No runtime file I/O. Cold start is unaffected.

### Step 2: Define Schemas

Paste the `zod_typescript` content from `v2-output-schema.json` here. It defines `VerdictSchema` and exports the `Verdict` type.

Then add request and API response schemas:

```typescript
const RequestSchema = z.object({
  idea: z.string().trim().min(10).max(2000),
})

const ErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(['INVALID_INPUT', 'API_OVERLOAD', 'VALIDATION_FAILED', 'TIMEOUT', 'INTERNAL']),
    message: z.string(),
    retry_after_ms: z.number().optional(),
  }),
})

const SuccessSchema = z.object({
  ok: z.literal(true),
  data: VerdictSchema,
  meta: z.object({
    model: z.string(),
    duration_ms: z.number(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      cache_read: z.number(),
      cache_write: z.number(),
    }),
    cost_usd: z.number(),
  }),
})

const ApiResponseSchema = z.discriminatedUnion('ok', [SuccessSchema, ErrorSchema])
```

### Step 3: Helper Functions

#### XSS Guard (input sanitization)

For backend JSON input, full DOMPurify is overkill. Strip HTML tags with regex — that's enough since this string is never rendered as HTML by the API:

```typescript
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}
```

The frontend will be responsible for additional escaping when displaying the verdict.

#### JSON Extractor

Steal this verbatim from [dispatcher.ts:144-197](src/lib/orchestrator/dispatcher.ts#L144-L197) — it's the `extractAndParseJSON` function. Copy it into your route file (no shared util — keep it self-contained).

#### Cost Calculator

```typescript
function calculateCost(model: string, usage: Anthropic.Messages.Usage): number {
  const pricing = ANTHROPIC_PRICING[model as keyof typeof ANTHROPIC_PRICING]
  if (!pricing) {
    console.warn(`[verdict] Unknown model for pricing: ${model}`)
    return 0
  }

  const inputTokens = usage.input_tokens ?? 0
  const outputTokens = usage.output_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const regularInput = Math.max(0, inputTokens - cacheRead - cacheWrite)

  return (
    (regularInput / 1_000_000) * pricing.inputPerMillion +
    (cacheRead / 1_000_000) * pricing.cacheReadPerMillion +
    (cacheWrite / 1_000_000) * pricing.cacheWritePerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  )
}
```

#### Error Response Helper

```typescript
function errorResponse(
  code: 'INVALID_INPUT' | 'API_OVERLOAD' | 'VALIDATION_FAILED' | 'TIMEOUT' | 'INTERNAL',
  message: string,
  status: number,
  retryAfterMs?: number,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(retryAfterMs && { retry_after_ms: retryAfterMs }) } },
    { status },
  )
}
```

### Step 4: The POST Handler — Main Flow

```typescript
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // 4a. Parse body — guard against malformed JSON
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('INVALID_INPUT', 'Request body must be valid JSON', 400)
  }

  // 4b. Validate input shape
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input', 400)
  }

  const idea = stripHtml(parsed.data.idea)
  if (idea.length < 10) {
    return errorResponse('INVALID_INPUT', 'Idea too short after sanitization', 400)
  }

  // 4c. Call Anthropic with retry logic
  let verdict: Verdict
  let usage: Anthropic.Messages.Usage
  try {
    const result = await callAnthropicWithRetry(idea)
    verdict = result.verdict
    usage = result.usage
  } catch (err) {
    return handleAnthropicError(err)
  }

  // 4d. Build response
  const duration = Date.now() - startTime
  const cost = calculateCost(promptConfig.meta.model, usage)

  // 4e. Structured logging
  console.log(JSON.stringify({
    event: 'verdict_generated',
    duration_ms: duration,
    cost_usd: cost,
    verdict: verdict.verdict,
    confidence: verdict.confidence.score,
    cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  }))

  const response = {
    ok: true as const,
    data: verdict,
    meta: {
      model: promptConfig.meta.model,
      duration_ms: duration,
      tokens: {
        input: usage.input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
        cache_read: usage.cache_read_input_tokens ?? 0,
        cache_write: usage.cache_creation_input_tokens ?? 0,
      },
      cost_usd: cost,
    },
  }

  // 4f. Self-validate response shape — catches accidental drift
  const validated = ApiResponseSchema.safeParse(response)
  if (!validated.success) {
    console.error('[verdict] Response failed self-validation:', validated.error)
    return errorResponse('INTERNAL', 'Response shape error', 500)
  }

  return NextResponse.json(response)
}
```

### Step 5: The Anthropic Call With Retry

```typescript
async function callAnthropicWithRetry(idea: string): Promise<{
  verdict: Verdict
  usage: Anthropic.Messages.Usage
}> {
  const client = new Anthropic()

  // Attempt 1: standard request
  const attempt1 = await callAnthropicOnce(client, idea, /* validationRetry */ false)
  if (attempt1.ok) return attempt1

  // Attempt 2: validation failed → retry with corrective message
  if (attempt1.kind === 'validation_failed') {
    const attempt2 = await callAnthropicOnce(client, idea, true, attempt1.errors)
    if (attempt2.ok) return attempt2
    throw new Error(`VALIDATION_FAILED: ${attempt2.kind === 'validation_failed' ? attempt2.errors.join('; ') : 'unknown'}`)
  }

  // Other failure types propagate up
  throw attempt1.error
}

type CallResult =
  | { ok: true; verdict: Verdict; usage: Anthropic.Messages.Usage; kind: 'success' }
  | { ok: false; kind: 'validation_failed'; errors: string[] }
  | { ok: false; kind: 'api_error'; error: Error }

async function callAnthropicOnce(
  client: Anthropic,
  idea: string,
  isRetry: boolean,
  prevErrors?: string[],
): Promise<CallResult> {
  const userMessage = isRetry
    ? `Your previous response failed schema validation. Errors: ${prevErrors?.join('; ') ?? 'unknown'}. ` +
      `Respond with valid JSON only, matching the schema exactly. No markdown, no explanation outside JSON.\n\n` +
      `Evaluate this idea:\n\n${idea}`
    : `Evaluate this idea and respond with valid JSON only:\n\n${idea}`

  let response: Anthropic.Messages.Message
  try {
    response = await client.messages.create({
      model: promptConfig.meta.model,
      max_tokens: promptConfig.meta.max_tokens,
      temperature: promptConfig.meta.temperature,
      system: [
        {
          type: 'text',
          text: promptConfig.system_prompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch (err) {
    return { ok: false, kind: 'api_error', error: err as Error }
  }

  // Extract text content
  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return { ok: false, kind: 'api_error', error: new Error('No text content in response') }
  }

  // Extract & parse JSON
  let parsed: unknown
  try {
    parsed = extractAndParseJSON(textContent.text)
  } catch (err) {
    return {
      ok: false,
      kind: 'validation_failed',
      errors: [`JSON parse failed: ${err instanceof Error ? err.message : String(err)}`],
    }
  }

  // Validate against schema
  const result = VerdictSchema.safeParse(parsed)
  if (!result.success) {
    return {
      ok: false,
      kind: 'validation_failed',
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    }
  }

  return { ok: true, kind: 'success', verdict: result.data, usage: response.usage }
}
```

**Why this design:**
- One attempt for the happy path (cheap)
- One retry for validation failure with explicit corrective message
- API errors (429/529/network) are NOT retried in this layer — they propagate to `handleAnthropicError` which has its own retry logic via `Anthropic.APIError` checks. **For Step 1 MVP, we accept API errors as terminal** (return 503 to client). Adding API-level retry is a Step 1.5 improvement.

### Step 6: Anthropic Error Mapping

```typescript
function handleAnthropicError(err: unknown): NextResponse {
  console.error('[verdict] Anthropic call failed:', err)

  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) {
      const retryAfter = parseInt(err.headers?.['retry-after'] ?? '60', 10) * 1000
      return errorResponse('API_OVERLOAD', 'Rate limited by Anthropic', 503, retryAfter)
    }
    if (err.status === 529) {
      return errorResponse('API_OVERLOAD', 'Anthropic temporarily overloaded', 503, 5000)
    }
    if (err.status === 400) {
      return errorResponse('INTERNAL', 'Bad request to AI provider', 500)
    }
  }

  if (err instanceof Error && err.message.startsWith('VALIDATION_FAILED')) {
    return errorResponse('VALIDATION_FAILED', 'AI returned invalid output after retry', 502)
  }

  return errorResponse('INTERNAL', 'Unexpected error', 500)
}
```

### Step 7: CORS (Optional for MVP)

For local dev (`localhost:3000` calling `localhost:3000`) CORS is not an issue — same origin.

For production, the frontend will be served from the same Next.js app, so CORS is also not needed. **Skip CORS headers for Step 1.**

If we later add a separate frontend domain, add this OPTIONS handler:

```typescript
// Only add when needed:
// export async function OPTIONS(request: NextRequest) {
//   return new NextResponse(null, {
//     status: 204,
//     headers: {
//       'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
//       'Access-Control-Allow-Methods': 'POST, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type',
//     },
//   })
// }
```

### Step 8: Rate Limiting — Honest Decision

**MVP Decision: NO RATE LIMITING in code.**

Reasoning:
- An in-memory `Map` rate limiter looks like it works but is broken on Vercel serverless: each cold start gets a fresh function instance, so the Map resets. Hot reload in dev does the same thing.
- Adding Upstash Redis is correct but adds a new dependency, env var, and external service for the MVP.
- We currently have 0 users. Rate limiting is premature.
- Anthropic SDK errors will surface naturally if abuse happens, and we can handle that as a real signal.

**What to do instead:** Add a TODO comment at the top of the file:

```typescript
// TODO(v2.1): Add rate limiting via Upstash Redis when we have >100 daily users.
// In-memory Map does not work on Vercel serverless cold starts.
// See: https://upstash.com/docs/redis/sdks/ratelimit-ts
```

This documents the decision so future-you doesn't forget.

---

## What NOT to Build

Do not build any of these. They are explicit non-goals for this step:

- ❌ Multi-phase orchestration
- ❌ Tool use / tool handlers (Step 2)
- ❌ Streaming response (use regular `messages.create`, not stream — see "Streaming Note" below)
- ❌ Database persistence (no Supabase writes)
- ❌ User authentication
- ❌ In-memory rate limiting (broken on serverless — see Step 8)
- ❌ Webhook callbacks
- ❌ Background job queue
- ❌ Caching layer beyond Anthropic native prompt caching
- ❌ Multiple models / model fallback (Sonnet only for now)
- ❌ Helper utility files (`src/lib/verdict/...`) — keep it all in one route file
- ❌ Tests (will add in Step 3)
- ❌ TypeScript "improvements" to existing v1 code
- ❌ Editing `config.ts` for anything other than adding the `claude-sonnet-4-6` pricing entry (if missing)

If you find yourself adding any of these, **stop**. Send a message saying "I think we need X for reason Y" and wait for confirmation.

### Streaming Note

Verdict generation takes 4-7 seconds end-to-end. Without streaming, the user sees a blank screen for 4-7 seconds. This is bad UX but acceptable for Step 1 where we're testing the API contract.

**Step 2 (UI)** will need to either:
- (a) Show an engaging loading state with progress hints, OR
- (b) Convert this endpoint to streaming (`messages.stream()` instead of `messages.create()`)

Don't solve this in Step 1. Just be aware that the API response will sit on a 4-7 second TTFB.

---

## Acceptance Criteria

The implementation is done when ALL of these are true:

1. ✅ `POST /api/verdict` with valid idea returns `{ ok: true, data: Verdict, meta: {...} }`
2. ✅ Response shape passes `ApiResponseSchema.safeParse` (built-in self-validation step exists)
3. ✅ `POST /api/verdict` with invalid input returns `{ ok: false, error: { code: 'INVALID_INPUT', ... } }` and HTTP 400
4. ✅ `POST /api/verdict` with malformed JSON body returns 400 (does NOT crash)
5. ✅ Cost is calculated using `ANTHROPIC_PRICING` from `config.ts` (NOT hardcoded)
6. ✅ Prompt caching is enabled — verify by running 2 sequential requests, second has `meta.tokens.cache_read > 0`
7. ✅ Single new file: `src/app/api/verdict/route.ts`. Plus zero or one line addition to `config.ts` if model wasn't already priced.
8. ✅ No new dependencies added to `package.json`
9. ✅ `npm run build` succeeds with no TypeScript errors and no new ESLint warnings
10. ✅ Manual tests below pass (see "Manual Test Plan")

---

## Manual Test Plan

After implementation, run these commands and capture the output:

```bash
# Build check first
npm run build

# Start dev server in another terminal
npm run dev
```

Then run all 4 tests:

### Test 1: Bad idea (expect DONT)

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"Instagram clone yapmak istiyorum"}' \
  -o /tmp/verdict-test-1.json -w "\nHTTP %{http_code}\n"
```

**Expected:**
- HTTP 200
- `ok: true`
- `data.verdict === "DONT"`
- `data.confidence.score >= 85` (from golden test GT-01)
- `meta.cost_usd > 0` and `< 0.05`

### Test 2: Good idea (expect GO)

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"AI tool that reads legal contracts and highlights unfair clauses for freelancers"}' \
  -o /tmp/verdict-test-2.json -w "\nHTTP %{http_code}\n"
```

**Expected:**
- HTTP 200
- `data.verdict === "GO"`
- `data.confidence.score >= 70`
- `meta.tokens.cache_read > 0` (because Test 1 already populated cache)

### Test 3: Pivot idea (expect PIVOT)

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"AI podcast platform for everyone"}' \
  -o /tmp/verdict-test-3.json -w "\nHTTP %{http_code}\n"
```

**Expected:**
- HTTP 200
- `data.verdict === "PIVOT"`
- `data.pivot_suggestion` exists with `suggestion` and `why` fields
- `data.confidence.score` between 60 and 85

### Test 4: Invalid input (expect 400)

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"hi"}' \
  -o /tmp/verdict-test-4.json -w "\nHTTP %{http_code}\n"
```

**Expected:**
- HTTP 400
- `ok: false`
- `error.code === "INVALID_INPUT"`

### Test 5: Malformed JSON body (expect 400, must NOT crash)

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d 'this is not json' \
  -o /tmp/verdict-test-5.json -w "\nHTTP %{http_code}\n"
```

**Expected:**
- HTTP 400
- `error.code === "INVALID_INPUT"`
- Server console does NOT show an unhandled exception

---

## Reporting Format

When done, paste this report **as a chat message** (not as a file — implementer Claude can't attach files). Inline the JSON outputs.

```markdown
## Implementation Report — Step 1

**File created:** `src/app/api/verdict/route.ts` (X lines)
**Files modified:** `src/lib/optimization/config.ts` (added/skipped — explain)

**Build status:** ✅ pass / ❌ fail
**Build output:**
```
[paste relevant build output]
```

**Manual test results:**

### Test 1: Instagram clone (expect DONT)
- HTTP: 200
- Verdict: DONT ✅
- Confidence: 97
- Cost: $0.0089
- Cache read: 0 tokens (first request)

Full JSON:
```json
[paste /tmp/verdict-test-1.json contents]
```

### Test 2: Legal contract tool (expect GO)
- HTTP: 200
- Verdict: GO ✅
- Confidence: ?
- Cost: $?
- Cache read: ? tokens

Full JSON:
```json
[paste contents]
```

### Test 3: AI podcast (expect PIVOT)
[same format]

### Test 4: Invalid input (expect 400)
[same format]

### Test 5: Malformed JSON body (expect 400 no crash)
[same format]

**Pricing config update:**
- Was `claude-sonnet-4-6` already in `ANTHROPIC_PRICING`? yes/no
- If no, what entry did you add?

**Issues encountered:** [list any]

**Deviations from spec:** [list any, with justification]

**Questions for prompt engineer:** [optional]
```

---

## Why This Spec Is This Detailed

You (implementer) are working in a fresh session with no prior context. This spec encodes decisions so you don't have to re-derive them.

**Key principles encoded:**

1. **Prompt caching is critical** — saves ~90% input cost. Every request uses it.
2. **Single file** — no premature abstraction. We'll refactor when we have 3+ endpoints.
3. **No rate limiting code** — in-memory rate limit is broken on serverless. Document the decision, defer to v2.1.
4. **No database writes** — privacy + simplicity. Verdicts are ephemeral.
5. **Sonnet only** — model fallback adds complexity. Add it when we hit overload errors in production.
6. **Strict scope** — feature creep is the #1 solo dev risk. The "What NOT to Build" list exists for this reason.
7. **Reuse v1 patterns** — the codebase already has `extractAndParseJSON` and `ANTHROPIC_PRICING`. Don't rewrite.
8. **Self-validate response shape** — catches accidental drift between code and contract.

If anything in this spec is unclear, ask before building. Better to clarify upfront than to ship the wrong thing.
