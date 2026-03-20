# Council — Week 2 Benchmark Report

**Date:** 2026-03-08
**Phase:** 0 → 1 — Decomposition Proof
**Model:** Haiku (triage) + Sonnet (strategist) vs Sonnet-only

---

## 1. What We Did

Added a dual-step pipeline:
- **Step 1 — Triage (Haiku):** Analyzes founder prompt, extracts structured context (idea type, founder profile, concerns, section priorities, key questions)
- **Step 2 — Strategist (Sonnet):** Receives enriched prompt (triage context + original prompt) and generates the brief

Ran all 10 gold tests through 3 flows and did blind 3-way rubric evaluation.

---

## 2. Cost & Latency Comparison

| Metric | Council (single) | Dual (triage+strat) | Baseline |
|--------|------------------|---------------------|----------|
| **Total cost (10 runs)** | $0.359 | $0.420 | $0.343 |
| **Avg cost/mission** | $0.036 | $0.042 | $0.034 |
| **Avg duration** | 45.5s | 56.9s | 44.0s |
| **Avg output tokens** | 2367 | - | 2261 |

### Dual-step cost breakdown
| Component | Avg Cost | Avg Duration |
|-----------|----------|--------------|
| Triage (Haiku) | $0.0035 | 7.4s |
| Strategist (Sonnet) | $0.0384 | 49.5s |

**Triage overhead:** +$0.006/mission (+17%), +11.4s latency (+25%)

---

## 3. Quality Comparison (3-Way Blind Rubric)

### Dimension Averages (1-5 scale)
| Dimension | Council | Dual | Baseline |
|-----------|---------|------|----------|
| Specificity | 3.50 | **4.20** | 3.80 |
| Actionability | 4.00 | **4.20** | 4.10 |
| Depth | 3.30 | **3.90** | 3.80 |
| Realism | 3.80 | 3.90 | **4.00** |
| Decision Clarity | 4.00 | 4.20 | **4.40** |
| **Total Avg** | **18.60/25** | **20.40/25** | **20.10/25** |

### Win Rate
| Flow | Wins | Prompts Won |
|------|------|-------------|
| Baseline | **6** | g02, g03, g04, g05, g06, g08 |
| Dual | **2** | g01, g09 |
| Council | **2** | g07, g10 |

### Per-Prompt Scores
| Prompt | Council | Dual | Baseline | Winner |
|--------|---------|------|----------|--------|
| g01 resume-screening | 20 | **22** | 19 | Dual |
| g02 sustainable-fashion | 18 | 19 | **21** | Baseline |
| g03 restaurant-inventory | 18 | 19 | **22** | Baseline |
| g04 genz-finance | 15 | 20 | **21** | Baseline |
| g05 developer-docs | 17 | **22** | 21 | Baseline* |
| g06 rural-telehealth | 16 | 22 | **23** | Baseline |
| g07 ev-charging | **23** | 18 | 16 | Council |
| g08 ai-tutoring | 18 | 19 | **21** | Baseline |
| g09 cybersecurity | 18 | **24** | 20 | Dual |
| g10 social-commerce | **23** | 19 | 17 | Council |

*g05: Judge preferred baseline despite dual having higher score

---

## 4. Key Findings

### Finding 1: Dual improves Specificity and Depth most
- **Specificity:** Dual 4.20 vs Council 3.50 (+0.70) — the triage context helps the strategist be more specific
- **Depth:** Dual 3.90 vs Council 3.30 (+0.60) — structured context enables deeper analysis
- This makes sense: triage extracts concerns and key questions, giving the strategist a roadmap

### Finding 2: Baseline still wins on Decision Clarity
- **Decision Clarity:** Baseline 4.40 vs Dual 4.20 vs Council 4.00
- The simpler prompt may produce more focused, decisive output
- The enriched prompt might dilute the strategist's focus with too much extracted context

### Finding 3: Baseline wins overall (6/10)
- This is a **critical signal per the roadmap**: "If dual-step does not create clear value, do not expand agent count"
- Baseline is cheaper ($0.034 vs $0.042), faster (44s vs 57s), and wins more often

### Finding 4: Council (single) performs inconsistently
- Council won 2/10 in 3-way (g07, g10) but scored lowest average (18.60/25)
- The 10-0 win from Week 1 (Council vs Baseline) was likely LLM judge bias in pairwise comparison
- In 3-way evaluation, the bias is reduced and results are more balanced

### Finding 5: Dual has high ceiling but inconsistent
- Dual scored highest on 3 prompts (g01=22, g05=22, g09=24) showing potential
- But also scored low on g07=18, g10=19 — inconsistent

---

## 5. Decision Gate

From COUNCIL_OPERATING_ROADMAP:
> Success criteria: dual-step preferred in blind comparison often enough to justify complexity

### Status: FAIL — Dual does not justify its complexity

- Dual wins only 2/10 (20%) — not enough to justify +17% cost and +25% latency
- Baseline wins 6/10 at lowest cost and fastest speed
- The enriched prompt sometimes helps (specificity +0.70) but sometimes hurts (decision clarity -0.20)

### What this means:
Per the canonical strategy: **"Do not expand agent count."**

---

## 6. Root Cause Analysis

### Why does baseline beat Council's prompt?
The Council system prompt (4835 chars) is longer and more prescriptive than baseline (4043 chars). The extra instructions ("Council's Chief Strategist", "brutally honest") may over-constrain the model rather than helping it. The baseline's simpler framing may give the model more room to be natural.

### Why does dual sometimes excel?
When the founder's prompt is complex (g09: cybersecurity with multiple frameworks, multiple competitors, vertical vs horizontal decision), the triage step successfully decomposes it into structured context that produces a sharper brief.

### Why does dual sometimes fail?
When the founder's prompt is already well-structured (g07: EV charging, clear team/budget/concerns), the triage step adds noise rather than value.

---

## 7. Recommended Actions

### Immediate (this week)
1. **Simplify the Council system prompt** — reduce from 4835 to ~3500 chars, remove over-prescriptive personality instructions
2. **Make triage conditional** — only trigger triage for complex/ambiguous prompts, not for every mission
3. **Re-run benchmark** after prompt simplification

### If prompt simplification helps
- Move to Week 3 (Ugly MVP) with the improved single-prompt flow
- Keep dual pipeline code but don't activate by default

### If prompt simplification doesn't help
- Consider that the baseline prompt IS the better approach
- Strip Council prompt down to match baseline structure
- Focus on memory (Phase 1.5) as the real differentiator instead of prompt engineering

---

## 8. Cost Summary

| Item | Cost |
|------|------|
| 10 Dual-step runs | $0.420 |
| 10 3-way evaluations | ~$0.25 |
| **Total Week 2 benchmark** | **~$0.67** |
| **Cumulative (Week 1+2)** | **~$1.52** |

---

## Artifacts

- `src/lib/agents/triage.ts` — Triage agent prompt + schema
- `src/lib/pipeline/dual.ts` — Dual-step pipeline
- `benchmark/run-dual-benchmark.ts` — Dual runner
- `benchmark/rubric-v1-3way.ts` — 3-way evaluation
- `benchmark/results/dual/*.json` — Dual outputs
- `benchmark/results/evaluations-week2/*.json` — 3-way evaluations
