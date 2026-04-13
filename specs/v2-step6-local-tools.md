# Spec: v2 Step 6 — Local Tool Handlers (legal_check, finance_calc, tech_feasibility)

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Steps 1-5 complete, v2.1 LIVE on Vercel, `market_research` tool working with Exa
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Implement the remaining 3 tool handlers (`legal_check`, `finance_calc`, `tech_feasibility`) so Council verdicts are enriched with structured financial, legal, and technical data.

These tools are **local/template-based** — they do NOT call external APIs. They use the LLM's own knowledge, packaged into structured output via tool-result format. This is different from `market_research` which calls Exa for live web data.

**Why template-based instead of live API?**
- Legal: No affordable real-time legal compliance API exists for startups. LLM training data covers regulations well enough for an MVP.
- Finance: MVP cost estimation is heuristic-based, not database-driven. No API gives "how much does it cost to build X."
- Tech: Stack recommendation is pattern-matching from LLM knowledge. No API for "what stack should I use for X."

The LLM already fills these sections when it wants to (you can see `financials`, `tech_snapshot`, `legal_flags` in existing verdicts). These tool handlers make the data more **structured and consistent** by giving the LLM a formal tool-call path instead of ad-hoc generation.

---

## Critical Context

### 1. Existing Code to Read FIRST

- [src/app/api/verdict/route.ts](src/app/api/verdict/route.ts) — 614 lines. Contains the tool-use loop (`callAnthropicWithTools`), `market_research` handler, and the tool dispatch switch at **lines 441-464**. **This is the ONLY file you modify.**

- [prompts/v2-system-prompt.json](prompts/v2-system-prompt.json) — System prompt. Already defines all 4 tools in the `tools` array (lines 35-94 of the JSON). Tool definitions include `input_schema` for each. **Do NOT modify this file.**

### 2. Current Tool Dispatch Code (lines 441-464)

```typescript
for (const toolBlock of toolUseBlocks) {
  if (toolBlock.name === "market_research") {
    const result = await executeMarketResearch(
      toolBlock.input as MarketResearchInput,
    );
    // ... push tool_result
  } else {
    // Unknown tool — return error so LLM falls back gracefully
    toolResults.push({
      type: "tool_result",
      tool_use_id: toolBlock.id,
      content: JSON.stringify({
        error: `Tool ${toolBlock.name} not implemented yet`,
      }),
      is_error: true,
    });
  }
}
```

**Your job:** Replace the `else` fallback with handlers for `legal_check`, `finance_calc`, and `tech_feasibility`. Keep the final `else` for truly unknown tools.

### 3. Current `getActiveTools` Function (lines 358-376)

Currently only passes `market_research` to the API:

```typescript
const MARKET_RESEARCH_TOOL = promptConfig.tools.find(
  (t: { name: string }) => t.name === "market_research",
);

function getActiveTools(): Anthropic.Messages.Tool[] | undefined {
  if (!process.env.EXA_API_KEY) return undefined;
  if (!MARKET_RESEARCH_TOOL) return undefined;
  return [{ name: ..., description: ..., input_schema: ... }];
}
```

**Your job:** Pass ALL 4 tools to the API. The 3 new tools don't need env vars — they're always available. Only `market_research` is gated by `EXA_API_KEY`.

### 4. Tool Input Schemas (from v2-system-prompt.json)

**legal_check:**
```json
{
  "domain": "string (required) — e.g., healthcare, fintech, education",
  "regions": "string[] (optional) — e.g., US, EU, TR"
}
```

**finance_calc:**
```json
{
  "business_model": "enum: saas|marketplace|ecommerce|service|content|hardware|other (required)",
  "features": "string[] (required) — key features to build",
  "target_price": "number (optional) — expected $/user/month"
}
```

**tech_feasibility:**
```json
{
  "requirements": "string[] (required) — e.g., real-time video, payments, AI/ML"
}
```

### 5. What These Tools Return

These tools return **structured data the LLM generated itself** via tool_use, packaged so the LLM can reference it in the final verdict. This is a "self-tool" pattern — the LLM calls the tool, we process its input into a structured response, and feed it back.

**Key insight:** The handler functions don't need to be smart. They take the LLM's input, format it into a clean response structure, and return it. The LLM already did the thinking when it composed the tool_use input.

### 6. Claude Code Reference Patterns

**a) Tool dispatch pattern:**
File: `src/services/tools/toolExecution.ts` in Claude Code reference
Pattern: `switch(tool.name)` dispatch → each tool has its own handler function. We adapt this as `if/else if` chain in the existing tool dispatch loop.

**b) Local tool (no external API):**
Pattern: Tool handler receives input, applies simple logic (lookup tables, formulas, templates), returns structured result. No network calls, no async dependencies beyond the handler itself.

---

## Implementation Steps (Ordered)

### Step 0: Pre-Flight

1. Read `src/app/api/verdict/route.ts` completely (614 lines)
2. Find the tool dispatch switch at lines 441-464
3. Find `getActiveTools` at lines 358-376
4. Run `npm run build` — confirm pass before changes

### Step 1: Define Input/Output Types for 3 New Tools

Add these below the existing `MarketResearchInput` and `MarketResearchResult` types (around line 350):

```typescript
// ---- legal_check ----

interface LegalCheckInput {
  domain: string
  regions?: string[]
}

interface LegalCheckResult {
  domain: string
  regions: string[]
  risks: Array<{
    area: string
    severity: "critical" | "high" | "medium" | "low"
    description: string
    action_required: string
  }>
  source: "llm_analysis"
}

// ---- finance_calc ----

interface FinanceCalcInput {
  business_model: string
  features: string[]
  target_price?: number
}

interface FinanceCalcResult {
  business_model: string
  estimated_mvp_cost_monthly_usd: number
  breakeven_users: number
  suggested_price_usd: number
  unit_economics_summary: string
  source: "llm_estimate"
}

// ---- tech_feasibility ----

interface TechFeasibilityInput {
  requirements: string[]
}

interface TechFeasibilityResult {
  stack_suggestion: string
  complexity: "simple" | "moderate" | "complex" | "very_complex"
  estimated_mvp_weeks: number
  key_challenges: string[]
  source: "llm_analysis"
}
```

### Step 2: Write 3 Handler Functions

Add these below `executeMarketResearch` (after line 352):

```typescript
function executeLegalCheck(input: LegalCheckInput): LegalCheckResult {
  // Local tool — no API call. The LLM already analyzed legal risks
  // when it composed the tool_use input. We package it as structured data.
  const regions = input.regions ?? ["US"]
  
  // Return a template structure. The LLM will see this and incorporate
  // the domain/region context into its verdict's legal_flags section.
  return {
    domain: input.domain,
    regions,
    risks: [
      {
        area: `${input.domain} regulatory compliance`,
        severity: "medium",
        description: `Operating in ${input.domain} requires compliance review for ${regions.join(", ")}`,
        action_required: "Consult a lawyer specializing in " + input.domain,
      },
    ],
    source: "llm_analysis",
  }
}

function executeFinanceCalc(input: FinanceCalcInput): FinanceCalcResult {
  // Heuristic-based MVP cost estimation
  const featureCount = input.features.length
  const baseMonthly = input.business_model === "saas" ? 500
    : input.business_model === "marketplace" ? 800
    : input.business_model === "ecommerce" ? 600
    : input.business_model === "hardware" ? 1500
    : 400

  const estimatedCost = baseMonthly + (featureCount * 200)
  const suggestedPrice = input.target_price ?? (input.business_model === "saas" ? 15 : 29)
  const breakeven = Math.ceil(estimatedCost / suggestedPrice)

  return {
    business_model: input.business_model,
    estimated_mvp_cost_monthly_usd: estimatedCost,
    breakeven_users: breakeven,
    suggested_price_usd: suggestedPrice,
    unit_economics_summary: `${featureCount} features, $${estimatedCost}/mo infra, need ${breakeven} users at $${suggestedPrice}/mo to break even`,
    source: "llm_estimate",
  }
}

function executeTechFeasibility(input: TechFeasibilityInput): TechFeasibilityResult {
  // Complexity heuristic based on requirement count and keywords
  const reqs = input.requirements
  const hasRealtime = reqs.some(r => /real-?time|websocket|live/i.test(r))
  const hasAI = reqs.some(r => /ai|ml|machine.?learn|llm|gpt|model/i.test(r))
  const hasPayments = reqs.some(r => /payment|stripe|billing|subscription/i.test(r))
  const hasVideo = reqs.some(r => /video|stream|media/i.test(r))

  const complexFactors = [hasRealtime, hasAI, hasPayments, hasVideo].filter(Boolean).length
  const complexity: TechFeasibilityResult["complexity"] =
    reqs.length <= 2 && complexFactors === 0 ? "simple"
    : reqs.length <= 4 && complexFactors <= 1 ? "moderate"
    : reqs.length <= 6 && complexFactors <= 2 ? "complex"
    : "very_complex"

  const weeksMap = { simple: 4, moderate: 8, complex: 14, very_complex: 24 }

  const challenges: string[] = []
  if (hasRealtime) challenges.push("Real-time infrastructure (WebSockets, presence)")
  if (hasAI) challenges.push("AI/ML integration (model selection, latency, cost)")
  if (hasPayments) challenges.push("Payment processing (PCI compliance, Stripe integration)")
  if (hasVideo) challenges.push("Video/streaming infrastructure (encoding, CDN, bandwidth)")

  return {
    stack_suggestion: "Next.js + React + Supabase + Vercel" + (hasAI ? " + Claude API" : "") + (hasPayments ? " + Stripe" : ""),
    complexity,
    estimated_mvp_weeks: weeksMap[complexity],
    key_challenges: challenges.length > 0 ? challenges : ["Standard web application — no major technical risks"],
    source: "llm_analysis",
  }
}
```

**Design decisions:**
- **Synchronous** — no `async` needed, no external API calls
- **Deterministic** — same input → same output (for testing)
- **Heuristic-based** — simple formulas, not ML models. Good enough for MVP.
- **Source labeled** — `"llm_analysis"` or `"llm_estimate"` so UI can distinguish from `"exa_search"` real data

### Step 3: Update `getActiveTools` to Pass All 4 Tools

Replace the current `getActiveTools` function:

```typescript
// Extract all tool definitions from prompt config
const TOOL_DEFINITIONS = promptConfig.tools.map(
  (t: { name: string; description: string; input_schema: Record<string, unknown> }) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool.InputSchema,
  }),
)

// Build the tools array for the API call
// market_research requires EXA_API_KEY; the other 3 are always available
function getActiveTools(): Anthropic.Messages.Tool[] {
  if (process.env.EXA_API_KEY) {
    // All 4 tools available
    return TOOL_DEFINITIONS
  }
  // No Exa key — only local tools (legal, finance, tech)
  return TOOL_DEFINITIONS.filter((t) => t.name !== "market_research")
}
```

**Key change:** Function now ALWAYS returns tools (never `undefined`). The 3 local tools are always available. Only `market_research` is gated by `EXA_API_KEY`.

**IMPORTANT:** Since `getActiveTools` no longer returns `undefined`, update the call site in `callAnthropicWithTools`:

```typescript
// OLD:
...(tools && { tools }),

// NEW:
tools,
```

### Step 4: Update Tool Dispatch Switch

Replace the tool dispatch block (lines 441-464) with:

```typescript
for (const toolBlock of toolUseBlocks) {
  let resultContent: string

  if (toolBlock.name === "market_research") {
    const result = await executeMarketResearch(
      toolBlock.input as MarketResearchInput,
    )
    console.log(
      `[verdict] Exa search: "${result.query}" → ${result.result_count} results`,
    )
    resultContent = JSON.stringify(result)
  } else if (toolBlock.name === "legal_check") {
    const result = executeLegalCheck(toolBlock.input as LegalCheckInput)
    console.log(`[verdict] Legal check: domain=${result.domain}, regions=${result.regions.join(",")}`)
    resultContent = JSON.stringify(result)
  } else if (toolBlock.name === "finance_calc") {
    const result = executeFinanceCalc(toolBlock.input as FinanceCalcInput)
    console.log(`[verdict] Finance calc: model=${result.business_model}, cost=$${result.estimated_mvp_cost_monthly_usd}/mo`)
    resultContent = JSON.stringify(result)
  } else if (toolBlock.name === "tech_feasibility") {
    const result = executeTechFeasibility(toolBlock.input as TechFeasibilityInput)
    console.log(`[verdict] Tech feasibility: complexity=${result.complexity}, weeks=${result.estimated_mvp_weeks}`)
    resultContent = JSON.stringify(result)
  } else {
    // Truly unknown tool
    toolResults.push({
      type: "tool_result",
      tool_use_id: toolBlock.id,
      content: JSON.stringify({ error: `Tool ${toolBlock.name} not implemented` }),
      is_error: true,
    })
    continue
  }

  toolResults.push({
    type: "tool_result",
    tool_use_id: toolBlock.id,
    content: resultContent,
  })
}
```

### Step 5: Build & Test

```bash
npm run build   # Must pass
npm run dev     # Start dev server
```

---

## What NOT to Build

- ❌ External API calls for legal, finance, or tech tools (no Exa, no third-party APIs)
- ❌ Database storage of tool results
- ❌ Caching of tool results
- ❌ New tool definitions in the system prompt (already defined, don't touch)
- ❌ UI changes (VerdictCard already renders financials, tech_snapshot, legal_flags)
- ❌ New Zod schemas (existing VerdictSchema handles all sections)
- ❌ Changes to page.tsx, verdict-card.tsx, or any frontend files
- ❌ Changes to prompts/v2-system-prompt.json
- ❌ Parallel tool execution (sequential is fine for 3-4 tools)
- ❌ Tool retry logic (if a local tool fails, it's a bug — fix it, don't retry)

## What NOT to Change

- ❌ `market_research` handler — it works, don't touch it
- ❌ `callAnthropicWithTools` loop structure — only the tool dispatch switch changes
- ❌ Error handling (`handleAnthropicError`) — unchanged
- ❌ POST handler — unchanged
- ❌ VerdictSchema — unchanged
- ❌ Frontend files — unchanged

---

## Acceptance Criteria

1. ✅ `legal_check` tool handler exists and returns structured legal risk data
2. ✅ `finance_calc` tool handler exists and returns MVP cost, breakeven, pricing
3. ✅ `tech_feasibility` tool handler exists and returns stack, complexity, timeline
4. ✅ All 4 tools are passed to `messages.create()` (not just `market_research`)
5. ✅ When `EXA_API_KEY` is NOT set, 3 local tools still work (only `market_research` excluded)
6. ✅ Console logs show tool execution for each tool called
7. ✅ Verdict response contains populated `financials`, `tech_snapshot`, and/or `legal_flags` sections
8. ✅ No new dependencies added
9. ✅ No changes to frontend files or prompt files
10. ✅ `npm run build` passes
11. ✅ Single file modified: `src/app/api/verdict/route.ts`

---

## Manual Test Plan

```bash
npm run dev
```

### Test 1: Idea That Triggers All Tools

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"Online therapy platform with AI matching and video sessions for Turkey market"}'
```

**Expected:**
- Console shows tool calls for `market_research`, `legal_check`, `finance_calc`, `tech_feasibility`
- Response has populated `financials` section (MVP cost, breakeven, price)
- Response has populated `tech_snapshot` section (stack, complexity, weeks)
- Response may have `legal_flags` section (healthcare domain risks)

### Test 2: Simple Idea (Fewer Tools)

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"Instagram clone yapmak istiyorum"}'
```

**Expected:**
- DONT verdict
- May or may not trigger all tools (LLM decides)
- Should still work even if no tools are called

### Test 3: No EXA_API_KEY (Local Tools Only)

1. Remove `EXA_API_KEY` from `.env.local` temporarily
2. Restart dev server
3. Submit: "SaaS platform for restaurant inventory management"

**Expected:**
- `market_research` NOT called (no Exa key)
- `finance_calc`, `tech_feasibility`, `legal_check` STILL called (local tools always available)
- Verdict has `financials` and `tech_snapshot` populated
- Evidence sources show `training_data` instead of real URLs (no Exa)

### Test 4: GO Idea with Financials

```bash
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"AI tool that reads legal contracts and highlights unfair clauses for freelancers"}'
```

**Expected:**
- GO or PIVOT verdict
- `financials.business_model` populated (likely "saas")
- `financials.breakeven_users` is a reasonable number (not 0, not 999999)
- `tech_snapshot.complexity` is "moderate" or "complex"

### Test 5: Verify Existing Tests Still Pass

Run the same 2 tests from Step 1 to verify backward compatibility:

```bash
# Invalid input — should still return 400
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d '{"idea":"hi"}'

# Malformed JSON — should still return 400
curl -X POST http://localhost:3000/api/verdict \
  -H "Content-Type: application/json" \
  -d 'this is not json'
```

---

## Reporting Format

```markdown
## Implementation Report — Step 6

**File modified:** `src/app/api/verdict/route.ts` (before: X lines, after: Y lines)
**Dependencies added:** none

**Build status:** ✅ pass / ❌ fail

**Test results:**

### Test 1: All tools triggered
- market_research called: ✅/❌
- legal_check called: ✅/❌
- finance_calc called: ✅/❌
- tech_feasibility called: ✅/❌
- financials populated: ✅/❌
- tech_snapshot populated: ✅/❌
- legal_flags populated: ✅/❌

### Test 2: Simple DONT idea
- Verdict: DONT ✅/❌
- No crash: ✅/❌

### Test 3: No EXA_API_KEY
- Local tools work: ✅/❌
- market_research skipped: ✅/❌

### Test 4: GO idea with financials
- Financials populated: ✅/❌
- breakeven_users reasonable: ✅/❌
- tech complexity reasonable: ✅/❌

### Test 5: Backward compatibility
- Invalid input → 400: ✅/❌
- Malformed JSON → 400: ✅/❌

**Console log sample:** [paste one tool execution log line]
**Sample financials from response:** [paste financials object]
**Sample tech_snapshot from response:** [paste tech_snapshot object]

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
**Questions for prompt engineer:** [optional]
```

---

## Why Local/Template-Based Tools

The 3 new tools don't call external APIs. This might seem like a "fake" tool use. Here's why it's the right design:

1. **Consistency** — Without tools, the LLM sometimes generates financials, sometimes doesn't. With tool use, it explicitly decides "I need to calculate financials" → calls `finance_calc` → gets structured data → incorporates it. This makes the output more predictable.

2. **Upgradability** — When we later want to connect real APIs (e.g., legal compliance database, cost estimation service), we replace the handler body. The tool interface, dispatch code, and LLM behavior stay the same. Zero prompt changes needed.

3. **Observability** — Console logs show exactly which tools fired, with what inputs. This is invisible when the LLM generates data inline.

4. **Cost control** — The heuristic calculations in `finance_calc` and `tech_feasibility` are free (no API calls). The LLM's own analysis through the tool-use path costs the same tokens as inline generation.

The `market_research` tool is the only one that calls an external API (Exa). The other 3 are "self-tools" — the LLM calls them to structure its own thinking, not to fetch external data. This is a valid and common pattern in tool-use architectures.
