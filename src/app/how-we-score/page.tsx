"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { Separator } from "@/components/ui/separator";
import { verdict, getScoreColor } from "@/lib/design-tokens";

type Lang = "en" | "tr";

const CONTENT = {
  en: {
    title: "How We Score",
    intro: "Council evaluates every idea across 5 dimensions, applies penalties for structural risks, and assigns a verdict. Here's exactly how.",
    dimensionsTitle: "The 5 Dimensions",
    dimensionsSubtitle: "Each scored 0-20, summed to form the base score (0-100)",
    baseScoreTitle: "Base Score",
    baseScoreFormula: "baseScore = Team + Market + Traction + Defensibility + Timing",
    baseScoreRange: "Range: 0-100",
    penaltiesTitle: "Penalty System",
    penaltiesSubtitle: "Binary structural checks. Each applied penalty deducts 10 points.",
    councilScoreTitle: "Council Score",
    councilScoreFormula: "councilScore = max(0, baseScore - appliedPenalties × 10)",
    verdictTitle: "Verdict Decision Tree",
    verdictSubtitle: "The default verdict is risky. The model must prove a higher verdict is warranted.",
    dimensions: [
      {
        name: "Team",
        bands: [
          { range: "16-20", label: "Exceptional", desc: "Perfect founder-market fit, deep domain expertise, complementary skills, prior exits" },
          { range: "11-15", label: "Good", desc: "Good relevant experience, some gaps but manageable" },
          { range: "6-10", label: "Limited", desc: "Limited domain experience OR missing critical skills" },
          { range: "0-5", label: "Weak", desc: "No relevant experience, solo with no plan to hire gaps" },
        ],
      },
      {
        name: "Market",
        bands: [
          { range: "16-20", label: "Exceptional", desc: "Large proven market, clear buyer, validated willingness to pay" },
          { range: "11-15", label: "Good", desc: "Growing market, identified buyer, payment intent plausible" },
          { range: "6-10", label: "Limited", desc: "Uncertain market size, unclear buyer, unvalidated payment" },
          { range: "0-5", label: "Weak", desc: "Tiny/shrinking market, no clear buyer" },
        ],
      },
      {
        name: "Traction",
        bands: [
          { range: "16-20", label: "Exceptional", desc: "Revenue with strong retention, multiple paying customers, $10K+ MRR" },
          { range: "11-15", label: "Good", desc: "Users/pilots with engagement, early revenue, significant free usage" },
          { range: "6-10", label: "Limited", desc: "Prototype/demo only, no real users" },
          { range: "0-5", label: "Weak", desc: "Just an idea, nothing built" },
        ],
      },
      {
        name: "Defensibility",
        bands: [
          { range: "16-20", label: "Exceptional", desc: "Strong moat — network effects, data flywheel, patents, high switching costs" },
          { range: "11-15", label: "Good", desc: "Emerging moat, plausible path to defensibility" },
          { range: "6-10", label: "Limited", desc: "Weak moat, easy to replicate, no evidence of stickiness" },
          { range: "0-5", label: "Weak", desc: "No moat, commodity play" },
        ],
      },
      {
        name: "Timing",
        bands: [
          { range: "16-20", label: "Exceptional", desc: "Clear market inflection point, regulatory tailwind, technology unlock" },
          { range: "11-15", label: "Good", desc: "Good timing, growing trend, some tailwinds" },
          { range: "6-10", label: "Limited", desc: "Neutral timing, no clear catalyst, no visible momentum" },
          { range: "0-5", label: "Weak", desc: "Bad timing, headwinds, too early or too late" },
        ],
      },
    ],
    penalties: [
      {
        name: "Capital Insufficient",
        desc: "The stated budget covers less than 6 months of estimated burn rate.",
        exception: "Does not apply if founder has demonstrated real traction (paying users, active beta, or MRR).",
      },
      {
        name: "Founder-Market Mismatch",
        desc: "The founding team lacks critical domain expertise for this specific market.",
        exception: "General tech background does not count for regulated industries (healthcare, finance, legal).",
      },
      {
        name: "No Distribution",
        desc: "No clear path to first 100 customers. No existing audience, no channel partnerships, no organic strategy.",
        exception: '"We\'ll do marketing" is not a distribution strategy.',
      },
    ],
    verdicts: [
      {
        name: "STRONG",
        rules: ["councilScore \u2265 75", "No penalties", "Traction \u2265 14", "Team \u2265 14", "Defensibility \u2265 11"],
        note: "Reserved for exceptional ideas with proven traction.",
      },
      {
        name: "PROMISING",
        rules: ["councilScore 60-79", "No penalties", "Traction > 5", "Team > 8"],
        note: "Solid foundation with clear potential.",
      },
      {
        name: "RISKY",
        rules: ["Default verdict", "Everything else that doesn't qualify for weak"],
        note: "Needs more work before committing resources.",
      },
      {
        name: "WEAK",
        rules: ["councilScore < 40", "OR 3 penalties applied", "OR any dimension scored 0-1"],
        note: "Fundamental issues that must be resolved first.",
      },
    ],
  },
  tr: {
    title: "Nas\u0131l Puanl\u0131yoruz",
    intro: "Council her fikri 5 boyutta de\u011ferlendirir, yap\u0131sal riskler i\u00e7in cezalar uygular ve bir karar verir. \u0130\u015fte tam olarak nas\u0131l.",
    dimensionsTitle: "5 Boyut",
    dimensionsSubtitle: "Her biri 0-20 puan, toplam\u0131 taban puan\u0131 olu\u015fturur (0-100)",
    baseScoreTitle: "Taban Puan",
    baseScoreFormula: "tabanPuan = Ekip + Pazar + \u00c7eki\u015f + Savunulabilirlik + Zamanlama",
    baseScoreRange: "Aral\u0131k: 0-100",
    penaltiesTitle: "Ceza Sistemi",
    penaltiesSubtitle: "\u0130kili yap\u0131sal kontroller. Her uygulanan ceza 10 puan d\u00fc\u015fer.",
    councilScoreTitle: "Council Puan\u0131",
    councilScoreFormula: "councilPuan = max(0, tabanPuan - uygulananCezalar \u00d7 10)",
    verdictTitle: "Karar A\u011fac\u0131",
    verdictSubtitle: "Varsay\u0131lan karar riskli\u2019dir. Model daha y\u00fcksek bir karar\u0131 kan\u0131tlamal\u0131d\u0131r.",
    dimensions: [
      {
        name: "Ekip",
        bands: [
          { range: "16-20", label: "Ola\u011fan\u00fcst\u00fc", desc: "M\u00fckemmel kurucu-pazar uyumu, derin alan uzmanl\u0131\u011f\u0131, tamamlay\u0131c\u0131 beceriler" },
          { range: "11-15", label: "\u0130yi", desc: "\u0130yi d\u00fczeyde ilgili deneyim, baz\u0131 eksiklikler ama y\u00f6netilebilir" },
          { range: "6-10", label: "S\u0131n\u0131rl\u0131", desc: "S\u0131n\u0131rl\u0131 alan deneyimi VEYA eksik kritik beceriler" },
          { range: "0-5", label: "Zay\u0131f", desc: "Hi\u00e7 ilgili deneyim yok, tek ba\u015f\u0131na ve istihdam plan\u0131 yok" },
        ],
      },
      {
        name: "Pazar",
        bands: [
          { range: "16-20", label: "Ola\u011fan\u00fcst\u00fc", desc: "B\u00fcy\u00fck kan\u0131tlanm\u0131\u015f pazar, net al\u0131c\u0131, do\u011frulanm\u0131\u015f \u00f6deme iste\u011fi" },
          { range: "11-15", label: "\u0130yi", desc: "B\u00fcy\u00fcyen pazar, tan\u0131mlanm\u0131\u015f al\u0131c\u0131, makul \u00f6deme niyeti" },
          { range: "6-10", label: "S\u0131n\u0131rl\u0131", desc: "Belirsiz pazar b\u00fcy\u00fckl\u00fc\u011f\u00fc, belirsiz al\u0131c\u0131" },
          { range: "0-5", label: "Zay\u0131f", desc: "K\u00fc\u00e7\u00fck/k\u00fc\u00e7\u00fclen pazar, net al\u0131c\u0131 yok" },
        ],
      },
      {
        name: "\u00c7eki\u015f",
        bands: [
          { range: "16-20", label: "Ola\u011fan\u00fcst\u00fc", desc: "G\u00fc\u00e7l\u00fc elde tutma ile gelir, birden fazla \u00f6deme yapan m\u00fc\u015fteri, $10K+ MRR" },
          { range: "11-15", label: "\u0130yi", desc: "\u00d6l\u00e7\u00fclebilir etkile\u015fimli kullan\u0131c\u0131lar, erken gelir" },
          { range: "6-10", label: "S\u0131n\u0131rl\u0131", desc: "Yaln\u0131zca prototip/demo, ger\u00e7ek kullan\u0131c\u0131 yok" },
          { range: "0-5", label: "Zay\u0131f", desc: "Sadece bir fikir, hi\u00e7bir \u015fey in\u015fa edilmemi\u015f" },
        ],
      },
      {
        name: "Savunulabilirlik",
        bands: [
          { range: "16-20", label: "Ola\u011fan\u00fcst\u00fc", desc: "G\u00fc\u00e7l\u00fc hendek \u2014 a\u011f etkileri, veri \u00e7ark\u0131, patentler, y\u00fcksek ge\u00e7i\u015f maliyetleri" },
          { range: "11-15", label: "\u0130yi", desc: "Geli\u015fen hendek, savunulabilirli\u011fe makul yol" },
          { range: "6-10", label: "S\u0131n\u0131rl\u0131", desc: "Zay\u0131f hendek, kolay kopyalanabilir" },
          { range: "0-5", label: "Zay\u0131f", desc: "Hendek yok, emtia oyunu" },
        ],
      },
      {
        name: "Zamanlama",
        bands: [
          { range: "16-20", label: "Ola\u011fan\u00fcst\u00fc", desc: "Net pazar d\u00f6n\u00fcm noktas\u0131, d\u00fczenleyici r\u00fczgar, teknoloji kilidi a\u00e7ma" },
          { range: "11-15", label: "\u0130yi", desc: "\u0130yi zamanlama, b\u00fcy\u00fcyen trend, baz\u0131 olumlu r\u00fczgarlar" },
          { range: "6-10", label: "S\u0131n\u0131rl\u0131", desc: "N\u00f6tr zamanlama, net bir katalizz\u00f6r yok" },
          { range: "0-5", label: "Zay\u0131f", desc: "K\u00f6t\u00fc zamanlama, ters r\u00fczgarlar, \u00e7ok erken veya \u00e7ok ge\u00e7" },
        ],
      },
    ],
    penalties: [
      {
        name: "Sermaye Yetersizli\u011fi",
        desc: "Belirtilen b\u00fct\u00e7e tahmini 6 ayl\u0131k yakma h\u0131z\u0131ndan az\u0131n\u0131 kar\u015f\u0131l\u0131yor.",
        exception: "Kurucu ger\u00e7ek \u00e7eki\u015f g\u00f6stermi\u015fse (\u00f6deme yapan kullan\u0131c\u0131lar, aktif beta, MRR) uygulanmaz.",
      },
      {
        name: "Kurucu-Pazar Uyumsuzlu\u011fu",
        desc: "Kurucu ekip bu pazar i\u00e7in kritik alan uzmanl\u0131\u011f\u0131ndan yoksun.",
        exception: "Genel teknoloji ge\u00e7mi\u015fi d\u00fczenlenmi\u015f sekt\u00f6rler i\u00e7in ge\u00e7erli de\u011fildir.",
      },
      {
        name: "Da\u011f\u0131t\u0131m Yok",
        desc: "\u0130lk 100 m\u00fc\u015fteriye ula\u015fmak i\u00e7in net bir yol yok.",
        exception: '"Pazarlama yapaca\u011f\u0131z" bir da\u011f\u0131t\u0131m stratejisi de\u011fildir.',
      },
    ],
    verdicts: [
      {
        name: "G\u00dc\u00c7L\u00dc",
        rules: ["councilPuan \u2265 75", "Ceza yok", "\u00c7eki\u015f \u2265 14", "Ekip \u2265 14", "Savunulabilirlik \u2265 11"],
        note: "Kan\u0131tlanm\u0131\u015f \u00e7eki\u015fe sahip ola\u011fan\u00fcst\u00fc fikirler i\u00e7in ayr\u0131lm\u0131\u015ft\u0131r.",
      },
      {
        name: "UMUT VADEDEN",
        rules: ["councilPuan 60-79", "Ceza yok", "\u00c7eki\u015f > 5", "Ekip > 8"],
        note: "Net potansiyeli olan sa\u011flam temel.",
      },
      {
        name: "R\u0130SKL\u0130",
        rules: ["Varsay\u0131lan karar", "Zay\u0131f olmayan di\u011fer her \u015fey"],
        note: "Kaynak ay\u0131rmadan \u00f6nce daha fazla \u00e7al\u0131\u015fma gerekiyor.",
      },
      {
        name: "ZAYIF",
        rules: ["councilPuan < 40", "VEYA 3 ceza uygulanm\u0131\u015f", "VEYA herhangi bir boyut 0-1 puan"],
        note: "\u00d6nce \u00e7\u00f6z\u00fclmesi gereken temel sorunlar.",
      },
    ],
  },
};

const verdictTokenMap: Record<string, keyof typeof verdict> = {
  STRONG: "strong", "G\u00dc\u00c7L\u00dc": "strong",
  PROMISING: "promising", "UMUT VADEDEN": "promising",
  RISKY: "risky", "R\u0130SKL\u0130": "risky",
  WEAK: "weak", ZAYIF: "weak",
};

const bandColor = (range: string) => {
  const score = parseInt(range.split("-")[0]);
  return getScoreColor(score, 20);
};

export default function HowWeScorePage() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("council_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  const t = CONTENT[lang];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <button
          onClick={() => {
            const next = lang === "en" ? "tr" : "en";
            setLang(next);
            localStorage.setItem("council_lang", next);
          }}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-bold text-muted-foreground hover:bg-muted transition-colors"
        >
          {lang === "en" ? "TR" : "EN"}
        </button>
      </AppHeader>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <div>
          <h1 className="text-2xl font-bold mb-2">{t.title}</h1>
          <p className="text-muted-foreground leading-relaxed">{t.intro}</p>
        </div>

        <Separator />

        {/* 5 Dimensions */}
        <section>
          <h2 className="text-lg font-semibold mb-1">{t.dimensionsTitle}</h2>
          <p className="text-sm text-muted-foreground mb-5">{t.dimensionsSubtitle}</p>

          <div className="space-y-4">
            {t.dimensions.map((dim) => (
              <div key={dim.name} className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold">{dim.name}</h3>
                  <p className="text-xs text-muted-foreground">0-20 {lang === "en" ? "points" : "puan"}</p>
                </div>
                <div className="divide-y">
                  {dim.bands.map((band) => (
                    <div key={band.range} className="px-5 py-3 flex gap-3 items-start">
                      <div className="shrink-0 flex items-center gap-2 w-20">
                        <div className={`w-2 h-2 rounded-full ${bandColor(band.range)}`} />
                        <span className="text-sm font-mono font-medium">{band.range}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{band.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{band.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Base Score */}
        <div className="bg-muted/50 rounded-xl p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t.baseScoreTitle}</p>
          <p className="font-mono text-sm font-medium">{t.baseScoreFormula}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.baseScoreRange}</p>
        </div>

        <Separator />

        {/* Penalties */}
        <section>
          <h2 className="text-lg font-semibold mb-1">{t.penaltiesTitle}</h2>
          <p className="text-sm text-muted-foreground mb-5">{t.penaltiesSubtitle}</p>

          <div className="space-y-3">
            {t.penalties.map((penalty) => (
              <div key={penalty.name} className="rounded-xl border border-status-error/10 bg-status-error/5 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-status-error/20 text-status-error">
                    -10 pts
                  </span>
                  <h3 className="font-semibold text-sm">{penalty.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{penalty.desc}</p>
                <p className="text-xs text-muted-foreground/80 italic">{penalty.exception}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Council Score */}
        <div className="bg-muted/50 rounded-xl p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t.councilScoreTitle}</p>
          <p className="font-mono text-sm font-medium">{t.councilScoreFormula}</p>
        </div>

        <Separator />

        {/* Verdict Tree */}
        <section>
          <h2 className="text-lg font-semibold mb-1">{t.verdictTitle}</h2>
          <p className="text-sm text-muted-foreground mb-5">{t.verdictSubtitle}</p>

          <div className="space-y-3">
            {t.verdicts.map((v) => {
              const style = verdict[verdictTokenMap[v.name] ?? "risky"];
              return (
                <div key={v.name} className={`rounded-xl border ${style.border} ${style.bg} p-5`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                    <h3 className={`font-bold ${style.text}`}>{v.name}</h3>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {v.rules.map((rule, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-muted-foreground shrink-0">&bull;</span>
                        <span className="font-mono text-xs mt-0.5">{rule}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground italic">{v.note}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer link */}
        <div className="text-center pt-4 pb-8">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            &larr; {lang === "en" ? "Back to Council" : "Council'a d\u00f6n"}
          </a>
        </div>
      </main>
    </div>
  );
}
