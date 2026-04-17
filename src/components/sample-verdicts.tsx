"use client";

import { useLang } from "@/lib/i18n";

type SampleVerdictKind = "GO" | "PIVOT" | "DON'T";

interface Sample {
  id: string;
  idea_en: string;
  idea_tr: string;
  verdict: SampleVerdictKind;
  confidence: number;
  reasons_en: readonly [string, string, string];
  reasons_tr: readonly [string, string, string];
}

const SAMPLE_VERDICTS: readonly Sample[] = [
  {
    id: "sample-go",
    idea_en: "AI that reads legal contracts for freelancers",
    idea_tr: "Freelancerlar için sözleşme okuyan AI",
    verdict: "GO",
    confidence: 78,
    reasons_en: [
      "Freelance market up 40% YoY — rising pain, rising budgets",
      "Clear willingness to pay: comparable tools (Ironclad) charge $20-50/mo",
      "MVP is shippable solo — no moat required to start",
    ],
    reasons_tr: [
      "Freelance pazar %40 yıllık büyüme — artan acı, artan bütçe",
      "Ödeme isteği net: benzer araçlar (Ironclad) $20-50/ay",
      "MVP tek kişi çıkabilir — başlamak için moat gerekmez",
    ],
  },
  {
    id: "sample-pivot",
    idea_en: "Marketplace connecting local farmers with restaurants",
    idea_tr: "Yerel çiftçileri restoranlarla buluşturan pazar yeri",
    verdict: "PIVOT",
    confidence: 64,
    reasons_en: [
      "Two-sided marketplace = liquidity trap; chicken-and-egg kills most attempts",
      "Thin margins can't absorb logistics + cold chain costs at early scale",
      "Pivot lives here: SaaS-for-existing-distributors beats building a marketplace",
    ],
    reasons_tr: [
      "Çift taraflı pazar = likidite tuzağı; tavuk-yumurta çoğu denemeyi öldürür",
      "İnce marj erken ölçekte lojistik + soğuk zincir maliyetini kaldıramaz",
      "Pivot burada: mevcut dağıtıcılara SaaS, sıfırdan pazar inşa etmekten iyi",
    ],
  },
  {
    id: "sample-dont",
    idea_en: "Instagram clone with blockchain rewards",
    idea_tr: "Blockchain ödüllü Instagram klonu",
    verdict: "DON'T",
    confidence: 91,
    reasons_en: [
      "Social is a winner-take-all duopoly (TikTok, IG) — no entry wedge",
      "Blockchain doesn't solve a user problem here, only founder's narrative",
      "Zero distribution advantage — users don't defect for tokens",
    ],
    reasons_tr: [
      "Sosyal kazan-her-şeyi duopolü (TikTok, IG) — giriş kaması yok",
      "Blockchain burada kullanıcı problemi çözmüyor, sadece founder anlatısı",
      "Sıfır dağıtım avantajı — kullanıcılar token için yer değiştirmez",
    ],
  },
];

const sampleConfig: Record<SampleVerdictKind, { label: string; bg: string; border: string; text: string; dot: string }> = {
  GO: {
    label: "GO",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  PIVOT: {
    label: "PIVOT",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  "DON'T": {
    label: "DON'T",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
};

function SampleVerdictCard({ sample, lang }: { sample: Sample; lang: "en" | "tr" }) {
  const config = sampleConfig[sample.verdict];
  const idea = lang === "tr" ? sample.idea_tr : sample.idea_en;
  const reasons = lang === "tr" ? sample.reasons_tr : sample.reasons_en;

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden opacity-80`}
      aria-label={`Example ${config.label} verdict`}
    >
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${config.dot}`} />
            <span className={`text-base font-black tracking-tight ${config.text}`}>
              {config.label}
            </span>
          </div>
          <span className={`text-xs font-bold tabular-nums ${config.text}`}>
            {sample.confidence}%
          </span>
        </div>
        <p className="text-sm text-foreground leading-snug mb-3">{idea}</p>
        <ul className="space-y-1.5">
          {reasons.map((reason, i) => (
            <li key={i} className="flex gap-2 text-xs text-foreground/70 leading-relaxed">
              <span className={`shrink-0 ${config.text} select-none`} aria-hidden="true">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SampleVerdicts() {
  const { lang, t } = useLang();

  return (
    <section className="mt-6 w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SAMPLE_VERDICTS.map((sample) => (
          <SampleVerdictCard key={sample.id} sample={sample} lang={lang} />
        ))}
      </div>
    </section>
  );
}
