"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SampleVerdicts } from "@/components/sample-verdicts";
import { VerdictCard } from "@/components/verdict-card";
import { LoadingSteps } from "@/components/loading-steps";
import { EntropyBg } from "@/components/entropy-bg";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/lib/i18n";
import { MOCK_VERDICT } from "./mock-verdict";

type Variant = "A" | "B" | "C" | "D";
type ViewState = "input" | "loading" | "verdict";

const FIRST_VISIT_KEY = "council_seen_samples_v3";

// ============================================================
// Variant D — inlined tight sample cards (2 reasons, /60 opacity)
// ============================================================

const TIGHT_SAMPLES = [
  {
    id: "sample-go",
    verdict: "GO" as const,
    confidence: 78,
    idea_en: "AI that reads legal contracts for freelancers",
    idea_tr: "Freelancerlar için sözleşme okuyan AI",
    reasons_en: [
      "Freelance market up 40% YoY — rising pain, rising budgets",
      "Comparable tools (Ironclad) charge $20-50/mo",
    ],
    reasons_tr: [
      "Freelance pazar %40 yıllık büyüme",
      "Benzer araçlar (Ironclad) $20-50/ay",
    ],
  },
  {
    id: "sample-pivot",
    verdict: "PIVOT" as const,
    confidence: 64,
    idea_en: "Marketplace connecting local farmers with restaurants",
    idea_tr: "Yerel çiftçileri restoranlarla buluşturan pazar yeri",
    reasons_en: [
      "Two-sided marketplace = liquidity trap",
      "Thin margins can't absorb logistics costs",
    ],
    reasons_tr: [
      "Çift taraflı pazar = likidite tuzağı",
      "İnce marj lojistik maliyeti kaldıramaz",
    ],
  },
  {
    id: "sample-dont",
    verdict: "DON'T" as const,
    confidence: 91,
    idea_en: "Instagram clone with blockchain rewards",
    idea_tr: "Blockchain ödüllü Instagram klonu",
    reasons_en: [
      "Social is a winner-take-all duopoly — no entry wedge",
      "Blockchain doesn't solve a user problem here",
    ],
    reasons_tr: [
      "Sosyal kazan-her-şeyi duopolü — giriş kaması yok",
      "Blockchain kullanıcı problemi çözmüyor",
    ],
  },
];

const tightConfig: Record<"GO" | "PIVOT" | "DON'T", { bg: string; border: string; text: string; dot: string }> = {
  GO:      { bg: "bg-emerald-500/5", border: "border-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  PIVOT:   { bg: "bg-amber-500/5",   border: "border-amber-500/10",   text: "text-amber-600 dark:text-amber-400",     dot: "bg-amber-500" },
  "DON'T": { bg: "bg-red-500/5",     border: "border-red-500/10",     text: "text-red-600 dark:text-red-400",         dot: "bg-red-500" },
};

function SampleVerdictsTight({ lang }: { lang: "en" | "tr" }) {
  return (
    <section className="mt-4 w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TIGHT_SAMPLES.map((s) => {
          const c = tightConfig[s.verdict];
          const idea = lang === "tr" ? s.idea_tr : s.idea_en;
          const reasons = lang === "tr" ? s.reasons_tr : s.reasons_en;
          return (
            <div key={s.id} className={`rounded-lg border ${c.border} ${c.bg} opacity-60 hover:opacity-100 transition-opacity`}>
              <div className="px-3 pt-3 pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    <span className={`text-xs font-bold tracking-tight ${c.text}`}>{s.verdict}</span>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${c.text}`}>{s.confidence}%</span>
                </div>
                <p className="text-xs text-foreground/80 leading-snug mb-2">{idea}</p>
                <ul className="space-y-1">
                  {reasons.map((r, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-foreground/60 leading-relaxed">
                      <span className={`shrink-0 ${c.text} select-none`} aria-hidden="true">·</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// Page
// ============================================================

export default function LandingV3Lab() {
  const { lang, t } = useLang();
  const [variant, setVariant] = useState<Variant>("C");
  const [viewState, setViewState] = useState<ViewState>("input");
  const [idea, setIdea] = useState("");
  const [samplesOpenC, setSamplesOpenC] = useState(false);

  useEffect(() => {
    if (variant !== "C") return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
      setSamplesOpenC(true);
      localStorage.setItem(FIRST_VISIT_KEY, "1");
    }
  }, [variant]);

  const handleSubmit = useCallback(() => {
    if (idea.trim().length < 10 || viewState === "loading") return;
    setViewState("loading");
    setTimeout(() => setViewState("verdict"), 4000);
  }, [idea, viewState]);

  const resetAll = () => {
    setIdea("");
    setViewState("input");
  };

  const toggleFirstVisitFlag = () => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(FIRST_VISIT_KEY)) {
      localStorage.removeItem(FIRST_VISIT_KEY);
    } else {
      localStorage.setItem(FIRST_VISIT_KEY, "1");
    }
  };

  const clearLabStorage = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(FIRST_VISIT_KEY);
    setSamplesOpenC(false);
  };

  const renderComposer = () => (
    <div className="w-full max-w-lg">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div className="rounded-xl border border-border/40 bg-card">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={3}
            placeholder={t("placeholder")}
            className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <button
              type="submit"
              disabled={idea.trim().length < 10}
              aria-label={t("hero_cta")}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-10 hover:opacity-80 transition-all"
            >
              <span>{t("hero_cta")}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  const renderHeading = () => (
    <>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{t("hero_h1")}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t("hero_h2")}</p>
    </>
  );

  const renderInputHero = () => {
    // Variant A — Typography-first: H1 + H2 + composer only
    if (variant === "A") {
      return (
        <div className="flex-1 flex flex-col items-center pt-[10vh]">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{t("hero_h1")}</h1>
          <p className="text-sm text-muted-foreground mb-10">{t("hero_h2")}</p>
          {renderComposer()}
        </div>
      );
    }

    // Variant B — Inline chips: samples as a single line
    if (variant === "B") {
      return (
        <div className="flex-1 flex flex-col items-center pt-[8vh]">
          {renderHeading()}
          <p className="text-xs mb-6 tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">GO 78%</span>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            <span className="text-amber-600 dark:text-amber-400">PIVOT 64%</span>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            <span className="text-red-600 dark:text-red-400">DON&apos;T 91%</span>
            <span className="ml-2 text-muted-foreground/60">— {lang === "tr" ? "örnek çıktılar" : "see examples"}</span>
          </p>
          {renderComposer()}
        </div>
      );
    }

    // Variant C — Progressive disclosure (default)
    if (variant === "C") {
      return (
        <div className="flex-1 flex flex-col items-center pt-[8vh]">
          {renderHeading()}
          <button
            onClick={() => setSamplesOpenC((v) => !v)}
            className="text-xs text-muted-foreground/60 hover:text-foreground mb-4 transition-colors"
          >
            {samplesOpenC
              ? (lang === "tr" ? "Örnekleri gizle ↑" : "Hide examples ↑")
              : (lang === "tr" ? "Örnekleri gör ↓" : "See examples ↓")}
          </button>
          {samplesOpenC && (
            <div className="w-full mb-6">
              <SampleVerdicts />
            </div>
          )}
          {renderComposer()}
        </div>
      );
    }

    // Variant D — Tight-only (conservative)
    return (
      <div className="flex-1 flex flex-col items-center pt-[6vh]">
        {renderHeading()}
        <SampleVerdictsTight lang={lang} />
        <div className="mt-4">{renderComposer()}</div>
      </div>
    );
  };

  // Variant D uses a narrower container
  const containerMaxWidth = variant === "D" ? "max-w-xl" : "max-w-2xl";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/20">
        <div className={`${containerMaxWidth} mx-auto px-6 h-12 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">Council</Link>
            <span className="text-xs text-muted-foreground/60">/ landing v3-lab</span>
          </div>
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
            {viewState !== "input" && (
              <button
                onClick={resetAll}
                className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                title={t("new_idea_tooltip")}
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={`flex-1 flex flex-col ${containerMaxWidth} w-full mx-auto px-6 pb-28`}>
        {viewState === "input" && renderInputHero()}

        {viewState === "loading" && (
          <div className="relative flex-1 flex flex-col items-center justify-center px-4">
            <EntropyBg />
            <div className="relative z-10">
              <LoadingSteps active={true} />
            </div>
          </div>
        )}

        {viewState === "verdict" && (
          <div className="py-8">
            <div className="max-w-lg mx-auto mb-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-1">{t("council_heard")}</p>
              <p className="text-sm text-foreground leading-relaxed italic">
                &ldquo;{MOCK_VERDICT.idea_summary}&rdquo;
              </p>
            </div>
            <VerdictCard verdict={MOCK_VERDICT} missionId={null} verdictId={null} />
            <div className="mt-6 text-center">
              <button onClick={resetAll} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("try_another")}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-4">
        <div className={`${containerMaxWidth} mx-auto px-6 flex items-center justify-center gap-4`}>
          <a href="https://github.com/ivala2081/council" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            GitHub
          </a>
          <a href="/privacy" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">Privacy</a>
          <a href="/terms" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">Terms</a>
        </div>
      </footer>

      {/* Lab toolbar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(560px,calc(100%-2rem))]">
        <div className="bg-card/85 backdrop-blur-xl border border-border/40 rounded-xl p-3 space-y-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground uppercase tracking-wider w-14 shrink-0">Variant</span>
            <div className="flex items-center gap-1">
              {(["A", "B", "C", "D"] as Variant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={`px-2.5 py-1 rounded-md transition-colors tabular-nums ${variant === v ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground uppercase tracking-wider w-14 shrink-0">View</span>
            <div className="flex items-center gap-1">
              {(["input", "loading", "verdict"] as ViewState[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setViewState(s)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${viewState === s ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs pt-1 border-t border-border/30 tabular-nums">
            <button onClick={clearLabStorage} className="text-muted-foreground/70 hover:text-foreground transition-colors">
              Reset storage
            </button>
            <button onClick={toggleFirstVisitFlag} className="text-muted-foreground/70 hover:text-foreground transition-colors">
              Toggle first-visit flag
            </button>
            <span className="ml-auto text-muted-foreground/60">v={variant} · s={viewState}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
