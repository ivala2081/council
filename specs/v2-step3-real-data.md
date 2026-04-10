# Spec: v2 Step 3 — Real Market Data via Exa Search

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Step 1 API route working, Step 2 UI working, prompt v2.4.0 deployed
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Add real-time market data to Council's verdicts by implementing the `market_research` tool handler. When the LLM decides it needs market evidence, it calls the `market_research` tool → we execute a real Exa search → return results → LLM uses them in the verdict.

This makes Council's evidence **real** instead of "training_data". Users see actual Reddit threads, GitHub repos, HN posts, competitor URLs as evidence sources.

**This step implements ONE tool only:** `market_research`. The other 3 tools in the prompt (`legal_check`, `finance_calc`, `tech_feasibility`) remain local/template-based — they don't need live web search. They are deferred to Step 4.

---

## Critical Context

### 1. Existing Code to Read FIRST

- [src/app/api/verdict/route.ts](src/app/api/verdict/route.ts) — Current route. ~310 lines. Uses `client.messages.create()` WITHOUT tools. Returns single JSON response. **This file will be modified.**

- [prompts/v2-system-prompt.json](prompts/v2-system-prompt.json) — System prompt v2.4.0. Already defines 4 tools (`market_research`, `legal_check`, `finance_calc`, `tech_feasibility`) in the `tools` array. **Currently the tools are defined but NOT passed to the API.** This step enables `market_research` only.

- [prompts/v2-output-schema.json](prompts/v2-output-schema.json) — Verdict schema. Evidence type already supports `"market_data"` with `source` field. **No schema changes needed.**

### 2. How Anthropic Tool Use Works

The current route sends `messages.create()` WITHOUT a `tools` param. The LLM responds with a text block containing JSON.

With tool use, the flow changes:

```
1. Send messages.create() WITH tools array
2. LLM responds with tool_use blocks (e.g., market_research call)
3. We execute the tool (Exa search)
4. We send tool_result back to the LLM
5. LLM responds with final text (verdict JSON, now with real evidence)
```

This is a **multi-turn loop**, not a single call. Max 2 turns (1 tool call + 1 final response).

### 3. Exa Search API

**Provider:** Exa (exa.ai)
**SDK:** `exa-js` (npm package)
**Pricing:** $0.003/search + $0.001/content extraction = ~$0.007 per search with 10 results
**Free credits:** $10 on signup

**Why Exa over Tavily:**
- Cheaper ($0.007 vs $0.008/search)
- Neural embeddings (better for semantic queries like "pain points for freelance contract review")
- Simpler API
- TypeScript SDK native
- No acquisition uncertainty (Tavily was acquired by Nebius Feb 2026)

**Env var needed:** `EXA_API_KEY`

### 4. Claude Code Reference Patterns

From `C:\repo\claude_ref\code`:

**a) Tool execution in query loop:**
File: `src/query.ts` (line 307-432)
```typescript
// Pattern: while(true) loop that handles tool_use → execute → feed result back
while (true) {
  const response = await callModel(...)
  if (response.stop_reason === 'tool_use') {
    const toolResults = await executeTools(response.tool_use_blocks)
    messages.push(assistantMessage, ...toolResults)
    continue  // next iteration sends tool results
  }
  break  // stop_reason === 'end_turn', we have final response
}
```
**Adapt this pattern for Council's verdict route.** Simplified: max 2 iterations (1 tool call, 1 final).

**b) Streaming tool executor concurrency:**
File: `src/services/tools/StreamingToolExecutor.ts`
Not needed for Step 3 — we execute one tool at a time. But relevant for future Step 4 when multiple tools fire.

**c) Error classification for tool failures:**
File: `src/services/tools/toolExecution.ts`
Pattern: `classifyToolError(error)` → telemetry-safe string. Use this pattern for Exa API failures — don't leak API keys or full URLs in error messages.

### 5. What Exa Returns

```typescript
import Exa from 'exa-js'
const exa = new Exa(process.env.EXA_API_KEY)

const results = await exa.searchAndContents("online therapy platform competitors", {
  numResults: 5,
  text: { maxCharacters: 500 },
  type: "auto",
})

// results.results = [
//   {
//     title: "BetterHelp vs Talkspace: Which Online Therapy Is Better?",
//     url: "https://www.reddit.com/r/therapy/comments/...",
//     text: "I've tried both and honestly BetterHelp is overpriced...",
//     publishedDate: "2024-11-15",
//     score: 0.92
//   },
//   ...
// ]
```

### 6. Cost Impact

Current (no tools): ~$0.02/verdict (1 API call)
With market_research: ~$0.03/verdict (2 API calls + $0.007 Exa)

Marginal cost: +$0.01/verdict. Acceptable for MVP.

---

## Implementation Steps (Ordered)

### Step 0: Pre-Flight

1. Read `src/app/api/verdict/route.ts` completely
2. Read the `tools` array in `prompts/v2-system-prompt.json`
3. Install Exa SDK: `npm install exa-js`
4. Add `EXA_API_KEY` to `.env.local` (user will provide key from exa.ai)
5. Run `npm run build` — confirm it still passes before changes

### Step 1: Install exa-js

```bash
npm install exa-js
```

This is the ONLY new dependency for this step.

### Step 2: Add Exa Tool Handler Function

In `src/app/api/verdict/route.ts`, add a new function below the existing helpers:

```typescript
import Exa from 'exa-js'

// Lazy-init Exa client (only when tool is called)
let exaClient: Exa | null = null
function getExaClient(): Exa {
  if (!exaClient) {
    const key = process.env.EXA_API_KEY
    if (!key) throw new Error('EXA_API_KEY not configured')
    exaClient = new Exa(key)
  }
  return exaClient
}

interface MarketResearchInput {
  keywords: string[]
  intent: 'validate_demand' | 'find_competitors' | 'check_sentiment' | 'find_pricing'
}

interface MarketResearchResult {
  query: string
  results: Array<{
    title: string
    url: string
    snippet: string
    date: string | null
    relevance: number
  }>
  source: 'exa_search'
  result_count: number
}

async function executeMarketResearch(input: MarketResearchInput): Promise<MarketResearchResult> {
  const exa = getExaClient()

  // Build search query from keywords + intent
  const intentPrefix: Record<string, string> = {
    validate_demand: 'user demand pain points for',
    find_competitors: 'competitors alternatives to',
    check_sentiment: 'user reviews opinions about',
    find_pricing: 'pricing plans cost of',
  }
  const query = `${intentPrefix[input.intent] ?? ''} ${input.keywords.join(' ')}`.trim()

  try {
    const searchResults = await exa.searchAndContents(query, {
      numResults: 5,
      text: { maxCharacters: 300 },
      type: 'auto',
    })

    return {
      query,
      results: searchResults.results.map(r => ({
        title: r.title ?? 'Untitled',
        url: r.url,
        snippet: r.text?.slice(0, 300) ?? '',
        date: r.publishedDate ?? null,
        relevance: r.score ?? 0,
      })),
      source: 'exa_search',
      result_count: searchResults.results.length,
    }
  } catch (err) {
    // Don't leak API details in error
    console.error('[verdict] Exa search failed:', err instanceof Error ? err.message : 'unknown')
    return {
      query,
      results: [],
      source: 'exa_search',
      result_count: 0,
    }
  }
}
```

**Key design decisions:**
- **Lazy client init:** Don't create Exa client unless tool is actually called. Most verdicts may not trigger a tool call.
- **Graceful failure:** If Exa fails, return empty results. The LLM will fall back to training data. Don't crash the verdict.
- **5 results max:** Enough for evidence, low cost ($0.007).
- **300 char snippet:** Enough for context, not overwhelming.
- **Query construction:** Prepend intent-specific phrase to keywords for better Exa neural search.

### Step 3: Extract Tool Definition from Prompt Config

Only pass the `market_research` tool to the API. The other 3 tools stay defined in the prompt but are NOT passed to the API (they remain aspirational for Step 4).

```typescript
// Extract only market_research tool from prompt config
const MARKET_RESEARCH_TOOL = promptConfig.tools.find(t => t.name === 'market_research')

// Build the tools array for the API call (only if EXA_API_KEY is configured)
function getActiveTools(): Anthropic.Messages.Tool[] | undefined {
  if (!process.env.EXA_API_KEY) return undefined  // No key = no tools = fallback to training data
  if (!MARKET_RESEARCH_TOOL) return undefined

  return [{
    name: MARKET_RESEARCH_TOOL.name,
    description: MARKET_RESEARCH_TOOL.description,
    input_schema: MARKET_RESEARCH_TOOL.input_schema as Anthropic.Messages.Tool.InputSchema,
  }]
}
```

**Why conditional:** If `EXA_API_KEY` is not set (e.g., local dev without Exa account), the route still works — just without real data. Graceful degradation.

### Step 4: Convert Single-Call to Tool-Use Loop

Replace the `callAnthropicOnce` function with a tool-use loop. The key change: after the first API call, if the response has `tool_use` blocks, execute them and send results back.

```typescript
async function callAnthropicWithTools(
  client: Anthropic,
  idea: string,
): Promise<{ verdict: Verdict; usage: Anthropic.Messages.Usage }> {
  const tools = getActiveTools()
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: `Evaluate this idea and respond with valid JSON only:\n\n${idea}` },
  ]

  let totalUsage: Anthropic.Messages.Usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }

  // Max 2 turns: initial + tool result
  for (let turn = 0; turn < 2; turn++) {
    const response = await client.messages.create({
      model: promptConfig.meta.model,
      max_tokens: promptConfig.meta.max_tokens,
      temperature: promptConfig.meta.temperature,
      system: [
        {
          type: 'text',
          text: SYSTEM_TEXT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
      ...(tools && { tools }),
    })

    // Accumulate token usage
    totalUsage.input_tokens += response.usage.input_tokens
    totalUsage.output_tokens += response.usage.output_tokens
    totalUsage.cache_read_input_tokens =
      (totalUsage.cache_read_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0)
    totalUsage.cache_creation_input_tokens =
      (totalUsage.cache_creation_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0)

    // Check if model wants to use a tool
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
    )

    if (toolUseBlocks.length > 0 && response.stop_reason === 'tool_use') {
      // Execute tools and collect results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

      for (const toolBlock of toolUseBlocks) {
        if (toolBlock.name === 'market_research') {
          const result = await executeMarketResearch(
            toolBlock.input as MarketResearchInput
          )
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result),
          })
        } else {
          // Unknown tool — return error so LLM falls back gracefully
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ error: `Tool ${toolBlock.name} not implemented yet` }),
            is_error: true,
          })
        }
      }

      // Add assistant message + tool results to conversation
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })

      continue  // next turn — LLM sees tool results and writes verdict
    }

    // No tool use — extract verdict from text
    const textContent = response.content.find(
      (c): c is Anthropic.Messages.TextBlock => c.type === 'text'
    )
    if (!textContent) {
      throw new Error('No text content in response')
    }

    const parsed = extractAndParseJSON(textContent.text)
    const result = VerdictSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(
        `VALIDATION_FAILED: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`
      )
    }

    return { verdict: result.data, usage: totalUsage }
  }

  // Should never reach here (max 2 turns), but safety fallback
  throw new Error('VALIDATION_FAILED: Max tool turns exceeded')
}
```

### Step 5: Update the POST Handler

Replace the existing `callAnthropicWithRetry` call with the new `callAnthropicWithTools`:

In the `POST` function, change:

```typescript
// OLD:
const result = await callAnthropicWithRetry(idea)
verdict = result.verdict
usage = result.usage

// NEW:
const client = new Anthropic()
const result = await callAnthropicWithTools(client, idea)
verdict = result.verdict
usage = result.usage
```

**Keep the existing error handling** (`handleAnthropicError`) — it still applies to the new function.

**Remove** `callAnthropicWithRetry` and `callAnthropicOnce` functions — they're replaced by `callAnthropicWithTools`.

### Step 6: Handle Validation Retry

The old code had a 2-attempt retry for validation failures. The new loop handles this differently:

- Turn 1: LLM may call tools or respond directly
- Turn 2: LLM sees tool results and responds with verdict

If validation fails after turn 2, we don't retry the entire flow (too expensive with tool calls). Instead, return `VALIDATION_FAILED` error.

**This is a deliberate simplification.** The prompt v2.4 already has schema embedded and achieves 16/20 accuracy — validation failures are rare (<5% in tests).

### Step 7: Update Environment Variables

In `.env.local`, add:

```
EXA_API_KEY=your-exa-api-key-here
```

On Vercel, add the same env var in Settings → Environment Variables.

### Step 8: Build & Test

```bash
npm run build   # Must pass (new exa-js dependency)
npm run dev     # Start dev server
```

---

## What NOT to Build

- ❌ `legal_check` tool handler (Step 4)
- ❌ `finance_calc` tool handler (Step 4)
- ❌ `tech_feasibility` tool handler (Step 4)
- ❌ Multiple tools in parallel (one tool at a time for now)
- ❌ Exa result caching/Redis (defer to v2.2)
- ❌ Streaming response (still single JSON)
- ❌ UI changes (VerdictCard already shows evidence sources)
- ❌ New Zod schemas (existing VerdictSchema handles market_data evidence type)
- ❌ Fallback to Tavily or other search provider
- ❌ Rate limiting on Exa calls
- ❌ Any changes to `prompts/v2-system-prompt.json`
- ❌ Any changes to `prompts/v2-output-schema.json`

## What NOT to Change

- ❌ VerdictCard component
- ❌ page.tsx
- ❌ System prompt
- ❌ Output schema
- ❌ Golden test harness

---

## Acceptance Criteria

1. ✅ `npm install exa-js` added to package.json
2. ✅ `POST /api/verdict` with valid idea still returns valid verdict (backward compatible)
3. ✅ When `EXA_API_KEY` is set, LLM may call `market_research` tool → Exa search executes → real data appears in evidence sources
4. ✅ When `EXA_API_KEY` is NOT set, route works exactly as before (graceful degradation)
5. ✅ Evidence in verdict response contains real URLs and source names (not just "training_data")
6. ✅ Exa search failure does NOT crash the verdict — returns empty results, LLM falls back
7. ✅ Cost per verdict with tool use < $0.05
8. ✅ Response time with tool use < 45 seconds
9. ✅ `npm run build` passes with no TS errors
10. ✅ Single file modified: `src/app/api/verdict/route.ts` (plus `package.json` for exa-js)

---

## Manual Test Plan

```bash
npm run dev
```

### Test 1: Without EXA_API_KEY (Graceful Degradation)

1. Remove `EXA_API_KEY` from `.env.local` temporarily
2. Restart dev server
3. Submit: "Online therapy platform"
4. **Expected:** Verdict returns normally, evidence uses "training_data" sources
5. Restore `EXA_API_KEY`

### Test 2: With EXA_API_KEY (Real Data)

1. Ensure `EXA_API_KEY` is in `.env.local`
2. Restart dev server
3. Submit: "Online therapy platform"
4. **Expected:** Verdict evidence should contain real URLs (reddit.com, news sites, etc.)
5. Check console log for `[verdict]` entries showing Exa search query and result count

### Test 3: Standard GO Case

1. Submit: "AI tool that reads legal contracts and highlights unfair clauses for freelancers"
2. **Expected:** GO verdict. Evidence may include real competitor URLs (DoNotPay, LawGeex references with actual URLs).

### Test 4: Standard DONT Case

1. Submit: "Instagram clone yapmak istiyorum"
2. **Expected:** DONT verdict. Evidence should reference Meta/Instagram with real data if tool was called, or training_data if not.

### Test 5: Exa Failure (Network simulation)

1. Set `EXA_API_KEY` to an invalid value: `EXA_API_KEY=invalid-key-12345`
2. Restart dev server
3. Submit any idea
4. **Expected:** Verdict still returns (graceful fallback). Console shows Exa error. Evidence uses "training_data".

---

## Reporting Format

```markdown
## Implementation Report — Step 3

**File modified:** `src/app/api/verdict/route.ts` (before: X lines, after: Y lines)
**Dependencies added:** `exa-js` (version X)

**Build status:** ✅ pass / ❌ fail

**Test results:**

### Test 1: No EXA_API_KEY (graceful degradation)
- Verdict returned: ✅/❌
- Used training_data sources: ✅/❌

### Test 2: With EXA_API_KEY (real data)
- Verdict returned: ✅/❌
- Evidence contains real URLs: ✅/❌
- Exa search query logged: ✅/❌
- Sample evidence source: [paste one URL from response]

### Test 3: GO case with real data
- Verdict: GO ✅/❌
- Real competitor URLs in evidence: ✅/❌

### Test 4: DONT case
- Verdict: DONT ✅/❌

### Test 5: Exa failure (invalid key)
- Verdict still returned: ✅/❌
- Console error logged: ✅/❌
- No crash: ✅/❌

**Response time comparison:**
- Without tools (old): ~Xs
- With tools (new): ~Xs

**Cost comparison:**
- Without tools: $X
- With tools: $X

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
**Questions for prompt engineer:** [optional]
```

---

## Why This Step Matters

Council's biggest trust weakness right now: evidence says "training_data" everywhere. Users see "Competitor — training_data" and think "you're making this up."

After this step, evidence says "Competitor — reddit.com/r/therapy/comments/abc123" — a clickable, verifiable source. This is the **trust layer** coming alive.

The difference between "Council says there's competition" and "Council found this Reddit thread about competition" is the difference between an AI opinion and an AI-backed insight.

---

Sources consulted for API choice:
- [Exa API Pricing](https://exa.ai/pricing)
- [Tavily Credits & Pricing](https://docs.tavily.com/documentation/api-credits)
- [Exa TypeScript SDK](https://ai-sdk.dev/tools-registry/exa)
