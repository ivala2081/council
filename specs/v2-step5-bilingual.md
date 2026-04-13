# Spec: v2 Step 5 — Bilingual UI (English + Turkish)

**Status:** 🔒 FROZEN — ready to implement
**Spec version:** 1.0
**Owner:** Implementer Claude (new session)
**Reviewer:** Prompt engineer Claude
**Prerequisite:** Steps 1-4 complete, v2.4 + Exa + UI polish LIVE
**Scope rule:** Do not add features beyond this spec. If something seems missing, ask before adding.

---

## Goal

Make Council's entire UI bilingual (English + Turkish). Currently the UI is a messy mix — headlines are Turkish, buttons are English, loading steps are English. This feels unprofessional and confusing.

After this step: **one language toggle, all UI strings switch consistently.**

**This is a UI-only change.** The verdict content itself (reasons, evidence, pivot suggestions) already adapts to the user's input language via the system prompt's `## LANGUAGE` rule. We are NOT changing the API, prompt, or verdict schema.

---

## Critical Context

### 1. Files to Read FIRST

- [src/app/page.tsx](src/app/page.tsx) — 300 lines. All hardcoded strings here.
- [src/components/verdict-card.tsx](src/components/verdict-card.tsx) — 297 lines. All verdict-related strings here.
- [src/app/layout.tsx](src/app/layout.tsx) — Root layout. html `lang` attribute lives here.

### 2. Architecture Decision: NO i18n Library

Do NOT install `next-intl`, `react-i18next`, or any i18n framework. Overkill for 2 languages and ~50 strings.

Instead: **one dictionary file + one React context + one toggle button.**

This is intentionally simple. We have 2 pages (landing + verdict view) and ~50 strings total. A full i18n framework adds routing complexity (`/en/...`, `/tr/...`), bundle size, and configuration overhead that doesn't justify itself for 2 languages.

### 3. Claude Code Reference Patterns

From `C:\repo\claude_ref\code`:

**a) Theme toggle pattern (reuse for language toggle):**
File: `src/components/theme-toggle.tsx` in Council codebase.
The ThemeToggle already exists — dark/light toggle with localStorage persistence. We'll build an identical pattern for language: `EN/TR` toggle, `localStorage.getItem('council-lang')`, React context for downstream components.

**b) Settings/preference persistence:**
File: `C:\repo\claude_ref\code/src/utils/settings/settings.ts`
Pattern: Layered settings with localStorage as the persistence layer. For Council: `council-lang` key in localStorage, default to browser `navigator.language` detection.

### 4. Inventory of All UI Strings

Below is the COMPLETE list of strings that need translation. There are exactly 50 strings across 2 files.

---

## The Dictionary

Create ONE file: `src/lib/i18n.tsx`

This file exports:
1. A `Lang` type (`'en' | 'tr'`)
2. A dictionary object with all strings
3. A React context + provider
4. A `useLang()` hook
5. A `t()` function (translation lookup)

```typescript
"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// ============================================================
// Types
// ============================================================

export type Lang = "en" | "tr"

// ============================================================
// Dictionary
// ============================================================

const dict = {
  // -- Page: Landing --
  headline: {
    en: "Honest verdict on your idea",
    tr: "Fikrine dürüst cevap",
  },
  subheadline: {
    en: "10 seconds, 3 reasons, brutally honest.",
    tr: "10 saniye, 3 sebep, acımasızca dürüst.",
  },
  placeholder: {
    en: "Describe your idea...",
    tr: "Fikrini anlat...",
  },
  submit_button: {
    en: "Get honest verdict",
    tr: "Dürüst cevap al",
  },
  try_label: {
    en: "Try:",
    tr: "Dene:",
  },
  input_hint: {
    en: "Enter to send · Shift+Enter for newline",
    tr: "Enter ile gönder · Shift+Enter yeni satır",
  },
  try_again: {
    en: "Try again",
    tr: "Tekrar dene",
  },

  // -- Page: Loading --
  loading_step_1: {
    en: "Reading your idea...",
    tr: "Fikrin okunuyor...",
  },
  loading_step_2: {
    en: "Checking the market...",
    tr: "Pazar kontrol ediliyor...",
  },
  loading_step_3: {
    en: "Analyzing risks...",
    tr: "Riskler analiz ediliyor...",
  },
  loading_step_4: {
    en: "Building the verdict...",
    tr: "Karar oluşturuluyor...",
  },
  loading_step_5: {
    en: "Deep analysis — complex ideas take longer...",
    tr: "Derin analiz — karmaşık fikirler biraz daha uzun sürer...",
  },

  // -- Page: Verdict --
  council_heard: {
    en: "Council heard",
    tr: "Council şunu anladı",
  },
  not_quite: {
    en: "Not quite?",
    tr: "Tam değil mi?",
  },
  try_another: {
    en: "Try another idea",
    tr: "Başka bir fikir dene",
  },
  new_idea_tooltip: {
    en: "New idea",
    tr: "Yeni fikir",
  },

  // -- VerdictCard: Verdict labels --
  verdict_go_tagline: {
    en: "Do it.",
    tr: "Yap.",
  },
  verdict_pivot_tagline: {
    en: "Change one thing.",
    tr: "Bir şeyi değiştir.",
  },
  verdict_dont_tagline: {
    en: "Walk away.",
    tr: "Vazgeç.",
  },
  confidence_label: {
    en: "Confidence",
    tr: "Güven",
  },

  // -- VerdictCard: Drill-down --
  show_details: {
    en: "Show evidence details",
    tr: "Kanıt detaylarını göster",
  },
  hide_details: {
    en: "Hide details",
    tr: "Detayları gizle",
  },
  instead_try: {
    en: "Instead, try this",
    tr: "Bunun yerine bunu dene",
  },

  // -- VerdictCard: Financials --
  financials_title: {
    en: "Financials",
    tr: "Finansal",
  },
  mvp_cost: {
    en: "MVP Cost",
    tr: "MVP Maliyet",
  },
  breakeven: {
    en: "Breakeven",
    tr: "Başabaş",
  },
  suggested_price: {
    en: "Suggested Price",
    tr: "Önerilen Fiyat",
  },
  business_model: {
    en: "Model",
    tr: "Model",
  },

  // -- VerdictCard: Tech Snapshot --
  tech_title: {
    en: "Tech Snapshot",
    tr: "Teknik Özet",
  },
  stack: {
    en: "Stack",
    tr: "Stack",
  },
  complexity: {
    en: "Complexity",
    tr: "Karmaşıklık",
  },
  mvp_timeline: {
    en: "MVP Timeline",
    tr: "MVP Süre",
  },
  weeks: {
    en: "weeks",
    tr: "hafta",
  },
  users: {
    en: "users",
    tr: "kullanıcı",
  },

  // -- VerdictCard: Legal --
  legal_title: {
    en: "Legal Flags",
    tr: "Yasal Riskler",
  },

  // -- VerdictCard: Share --
  copy_link: {
    en: "Copy link",
    tr: "Link kopyala",
  },
  copied: {
    en: "Copied!",
    tr: "Kopyalandı!",
  },
  tweet: {
    en: "Tweet",
    tr: "Tweet",
  },

  // -- Evidence type labels --
  evidence_market_data: { en: "Market", tr: "Pazar" },
  evidence_competitor: { en: "Competitor", tr: "Rakip" },
  evidence_financial: { en: "Financial", tr: "Finansal" },
  evidence_technical: { en: "Technical", tr: "Teknik" },
  evidence_legal: { en: "Legal", tr: "Yasal" },
  evidence_pattern: { en: "Pattern", tr: "Örüntü" },
  evidence_training_data: { en: "Known data", tr: "Bilinen veri" },
  evidence_assumption: { en: "Assumption", tr: "Varsayım" },

} as const

export type DictKey = keyof typeof dict

// ============================================================
// Context + Hook
// ============================================================

const LangContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: DictKey) => string
}>({
  lang: "en",
  setLang: () => {},
  t: (key) => dict[key]?.en ?? key,
})

function detectLang(): Lang {
  if (typeof window === "undefined") return "en"
  const saved = localStorage.getItem("council-lang")
  if (saved === "en" || saved === "tr") return saved
  const browser = navigator.language?.toLowerCase() ?? ""
  return browser.startsWith("tr") ? "tr" : "en"
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")

  useEffect(() => {
    setLangState(detectLang())
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem("council-lang", l)
  }

  const t = (key: DictKey): string => {
    return dict[key]?.[lang] ?? dict[key]?.en ?? key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
```

---

## Implementation Steps (Ordered)

### Step 0: Pre-Flight

1. Read `src/app/page.tsx` and `src/components/verdict-card.tsx` completely
2. Read `src/app/layout.tsx` — note where providers are wrapped
3. Run `npm run build` — confirm pass before changes

### Step 1: Create i18n file

Create `src/lib/i18n.tsx` with the **exact content above**. No modifications needed — copy-paste.

### Step 2: Create Language Toggle Component

Create `src/components/lang-toggle.tsx`:

```tsx
"use client"

import { useLang } from "@/lib/i18n"

export function LangToggle() {
  const { lang, setLang } = useLang()

  return (
    <button
      onClick={() => setLang(lang === "en" ? "tr" : "en")}
      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors text-xs font-medium text-muted-foreground"
      title={lang === "en" ? "Türkçe'ye geç" : "Switch to English"}
    >
      {lang === "en" ? "TR" : "EN"}
    </button>
  )
}
```

**Design:** Identical to ThemeToggle size/style. Shows `TR` when English is active (click to switch to TR), `EN` when Turkish is active.

### Step 3: Wrap Layout with LangProvider

In `src/app/layout.tsx`, wrap children with `<LangProvider>`:

```tsx
import { LangProvider } from "@/lib/i18n"

// Inside the body:
<LangProvider>
  {children}
</LangProvider>
```

**IMPORTANT:** Place `LangProvider` INSIDE the existing body and ThemeProvider. Don't break existing layout structure. Just wrap `{children}`.

### Step 4: Add LangToggle to Header

In `src/app/page.tsx`, import and add LangToggle next to ThemeToggle in the header:

```tsx
import { LangToggle } from "@/components/lang-toggle"

// In header div, next to ThemeToggle:
<div className="flex items-center gap-1">
  <LangToggle />
  <ThemeToggle />
  {/* existing new idea button */}
</div>
```

### Step 5: Replace Hardcoded Strings in page.tsx

Import `useLang` at the top of the Home component:

```tsx
import { useLang } from "@/lib/i18n"

export default function Home() {
  const { t } = useLang()
  // ...
```

Then replace ALL hardcoded strings. Here is the exact mapping:

| Current string | Replace with |
|---|---|
| `"Fikrine dürüst cevap"` | `{t("headline")}` |
| `"10 saniye, 3 sebep, acımasızca dürüst."` | `{t("subheadline")}` |
| `placeholder="Describe your idea..."` | `placeholder={t("placeholder")}` |
| `"Dürüst cevap al"` | `{t("submit_button")}` |
| `"Try:"` | `{t("try_label")}` |
| `"Enter to send · Shift+Enter for newline"` | `{t("input_hint")}` |
| `"Try again"` | `{t("try_again")}` |
| `"Council heard"` | `{t("council_heard")}` |
| `"Not quite?"` | `{t("not_quite")}` |
| `"Try another idea"` | `{t("try_another")}` |
| `title="New idea"` | `title={t("new_idea_tooltip")}` |

**LOADING_STEPS constant** — replace the static array with a function that uses `t()`:

```tsx
// DELETE the old LOADING_STEPS constant at top of file

// INSIDE the component (after useLang):
const loadingSteps = [
  { delay: 0, text: t("loading_step_1") },
  { delay: 3000, text: t("loading_step_2") },
  { delay: 8000, text: t("loading_step_3") },
  { delay: 15000, text: t("loading_step_4") },
  { delay: 25000, text: t("loading_step_5") },
]
```

Update the loading render to use `loadingSteps` instead of `LOADING_STEPS`.

**EXAMPLES constant** — keep the texts as-is (they're idea examples, not UI labels). Only translate the "Try:" label.

### Step 6: Replace Hardcoded Strings in verdict-card.tsx

Import `useLang` at the top:

```tsx
import { useLang } from "@/lib/i18n"
```

Add `const { t } = useLang()` inside VerdictCard component (first line of the function body).

Replace ALL hardcoded strings:

**Verdict config taglines:**

Currently `verdictConfig` is a const outside the component. The taglines need translation, so move them inside or use `t()`:

```tsx
// Replace static tagline in verdictConfig with dynamic lookup inside component:
const tagline = {
  GO: t("verdict_go_tagline"),
  PIVOT: t("verdict_pivot_tagline"),
  DONT: t("verdict_dont_tagline"),
}[verdict.verdict]
```

**Keep verdictConfig outside** (colors don't change) but replace `config.tagline` usage with `tagline` variable inside component.

**Evidence label mapping:**

```tsx
// OLD:
const evidenceLabel: Record<string, string> = {
  market_data: "Market",
  competitor: "Competitor",
  // ...
}

// NEW (inside component):
const evidenceLabel: Record<string, string> = {
  market_data: t("evidence_market_data"),
  competitor: t("evidence_competitor"),
  financial: t("evidence_financial"),
  technical: t("evidence_technical"),
  legal: t("evidence_legal"),
  pattern: t("evidence_pattern"),
  training_data: t("evidence_training_data"),
  assumption: t("evidence_assumption"),
}
```

**Remaining string replacements:**

| Current string | Replace with |
|---|---|
| `"Confidence"` | `{t("confidence_label")}` |
| `"Show evidence details"` | `{t("show_details")}` |
| `"Hide details"` | `{t("hide_details")}` |
| `"Instead, try this"` | `{t("instead_try")}` |
| `"Financials"` | `{t("financials_title")}` |
| `"MVP Cost"` | `{t("mvp_cost")}` |
| `"Breakeven"` | `{t("breakeven")}` |
| `"Suggested Price"` | `{t("suggested_price")}` |
| `"Model"` | `{t("business_model")}` |
| `"Tech Snapshot"` | `{t("tech_title")}` |
| `"Stack"` | `{t("stack")}` |
| `"Complexity"` | `{t("complexity")}` |
| `"MVP Timeline"` | `{t("mvp_timeline")}` |
| `"Legal Flags"` | `{t("legal_title")}` |
| `"Copy link"` | `{t("copy_link")}` |
| `"Copied!"` | `{t("copied")}` |
| `"Tweet"` | `{t("tweet")}` |
| `${verdict.financials.breakeven_users} users` | `${verdict.financials.breakeven_users} ${t("users")}` |
| `${verdict.tech_snapshot.estimated_mvp_weeks} weeks` | `${verdict.tech_snapshot.estimated_mvp_weeks} ${t("weeks")}` |

### Step 7: Update html lang Attribute

In `src/app/layout.tsx`, the `<html lang="en">` is static. For SSR this is fine — the language detection happens client-side. Leave `lang="en"` as default. The LangProvider handles the rest client-side.

**Optional improvement:** If you want, add `useEffect` in layout to update `document.documentElement.lang` when lang changes. But this is cosmetic and NOT required for this spec.

### Step 8: Build & Test

```bash
npm run build
npm run dev
```

---

## What NOT to Build

- ❌ URL-based routing (`/en/...`, `/tr/...`) — overkill for 2 languages
- ❌ Server-side language detection via headers — client-side localStorage is enough
- ❌ `next-intl`, `react-i18next`, or any i18n library — our approach is simpler
- ❌ Language-specific fonts — same font works for both
- ❌ RTL support — both EN and TR are LTR
- ❌ Translation of verdict CONTENT (reasons, evidence, pivot) — the system prompt already handles this
- ❌ Translation of example chip IDEAS — they stay mixed EN/TR (that's intentional — shows both languages work)
- ❌ Date/number formatting per locale — no dates shown in UI currently
- ❌ New pages, new routes, new API changes

---

## Acceptance Criteria

1. ✅ `src/lib/i18n.tsx` created with ~50 string pairs (en + tr)
2. ✅ `src/components/lang-toggle.tsx` created
3. ✅ `LangProvider` wraps app in layout.tsx
4. ✅ `LangToggle` visible in header next to ThemeToggle
5. ✅ Clicking `TR` switches ALL UI strings to Turkish
6. ✅ Clicking `EN` switches ALL UI strings to English
7. ✅ Language persists across page reload (localStorage)
8. ✅ Browser Turkish auto-detects TR on first visit
9. ✅ Browser English auto-detects EN on first visit
10. ✅ **Zero hardcoded user-facing strings** remain in page.tsx and verdict-card.tsx
11. ✅ Verdict content language still depends on INPUT language (not UI toggle)
12. ✅ `npm run build` passes
13. ✅ Dark mode still works
14. ✅ Mobile (375px) — LangToggle fits in header without overflow

---

## Manual Test Plan

### Test 1: Default language detection

1. Clear localStorage (`localStorage.removeItem('council-lang')`)
2. Set browser language to Turkish (Chrome Settings → Languages → Turkish first)
3. Reload page
4. **Expected:** All UI in Turkish, toggle shows "EN"

### Test 2: Default English detection

1. Clear localStorage
2. Set browser language to English
3. Reload page
4. **Expected:** All UI in English, toggle shows "TR"

### Test 3: Toggle EN → TR

1. Open page (English UI)
2. Click "TR" button in header
3. **Expected:** ALL strings switch to Turkish instantly:
   - Headline → "Fikrine dürüst cevap"
   - Submit button → "Dürüst cevap al"
   - Placeholder → "Fikrini anlat..."
   - Try label → "Dene:"
   - Input hint → "Enter ile gönder · Shift+Enter yeni satır"

### Test 4: Toggle TR → EN

1. From Turkish UI, click "EN" button
2. **Expected:** ALL strings switch to English:
   - Headline → "Honest verdict on your idea"
   - Submit button → "Get honest verdict"
   - etc.

### Test 5: Persistence across reload

1. Set language to TR
2. Close tab
3. Reopen page
4. **Expected:** UI is still in Turkish

### Test 6: Verdict card in Turkish UI

1. Switch to TR
2. Submit an idea (in Turkish): "Instagram clone yapmak istiyorum"
3. Wait for verdict
4. **Expected:**
   - "Council şunu anladı" (not "Council heard")
   - "Tam değil mi?" (not "Not quite?")
   - Verdict tagline: "Vazgeç." (not "Walk away.")
   - "Güven" (not "Confidence")
   - "Kanıt detaylarını göster" (not "Show evidence details")
   - "Bunun yerine bunu dene" (not "Instead, try this")
   - "Finansal" (not "Financials")
   - "Teknik Özet" (not "Tech Snapshot")
   - "Link kopyala" (not "Copy link")
   - Evidence labels: "Pazar", "Rakip", "Varsayım" etc.

### Test 7: Verdict card in English UI

1. Switch to EN
2. Submit same idea
3. **Expected:** All verdict card labels in English

### Test 8: Verdict CONTENT stays input-language-dependent

1. Switch UI to English
2. Submit idea in Turkish: "Online terapi platformu yapmak istiyorum"
3. **Expected:** UI labels in English, but verdict REASONS in Turkish (because input was Turkish)
4. Switch UI to Turkish
5. Submit idea in English: "AI tool for legal contracts"
6. **Expected:** UI labels in Turkish, but verdict REASONS in English (because input was English)

This test verifies that UI language and verdict content language are INDEPENDENT.

### Test 9: Loading state bilingual

1. Switch to TR
2. Submit an idea
3. **Expected:** Loading steps in Turkish: "Fikrin okunuyor...", "Pazar kontrol ediliyor...", etc.

### Test 10: Mobile + Dark Mode

1. iPhone SE viewport (375px)
2. Verify LangToggle fits in header (no overflow)
3. Toggle dark mode + language toggle
4. **Expected:** Both work independently

---

## Reporting Format

```markdown
## Implementation Report — Step 5

**Files created:**
- `src/lib/i18n.tsx` (X lines)
- `src/components/lang-toggle.tsx` (X lines)

**Files modified:**
- `src/app/layout.tsx` (added LangProvider)
- `src/app/page.tsx` (replaced hardcoded strings)
- `src/components/verdict-card.tsx` (replaced hardcoded strings)

**Build status:** ✅ pass / ❌ fail

**String count:** X strings in dictionary (expected: ~50)

**Test results:**

### Test 1: Auto-detect Turkish: ✅/❌
### Test 2: Auto-detect English: ✅/❌
### Test 3: Toggle EN→TR: ✅/❌
### Test 4: Toggle TR→EN: ✅/❌
### Test 5: Persistence: ✅/❌
### Test 6: Verdict card TR: ✅/❌
### Test 7: Verdict card EN: ✅/❌
### Test 8: Content vs UI language independence: ✅/❌
### Test 9: Loading state bilingual: ✅/❌
### Test 10: Mobile + dark mode: ✅/❌

**Remaining hardcoded strings found:** [list any, should be 0]

**Issues encountered:** [list any]
**Deviations from spec:** [list any, with justification]
```

---

## Why No i18n Library

| Aspect | next-intl | Our approach |
|---|---|---|
| Languages | Unlimited | 2 (en, tr) |
| Strings | 1000s | ~50 |
| Routing | /en/..., /tr/... | None (client-side toggle) |
| SSR | Full | Not needed |
| Bundle size | +15KB | ~2KB (our dict) |
| Config files | 5+ | 1 (i18n.tsx) |
| Learning curve | Medium | Zero |
| Migration later | Hard → easy | Easy → next-intl if needed |

When we have 5+ languages or 500+ strings, migrate to next-intl. For now, this is the right tool.
