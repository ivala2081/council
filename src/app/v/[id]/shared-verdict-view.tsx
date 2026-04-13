"use client"

import Link from "next/link"
import { CouncilMark } from "@/components/council-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { LangToggle } from "@/components/lang-toggle"
import { useLang } from "@/lib/i18n"
import type { ShareableVerdict } from "@/lib/verdict-share"

const verdictStyles = {
  GO: { label: "GO", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  PIVOT: { label: "PIVOT", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500", bar: "bg-amber-500" },
  DONT: { label: "DON'T", text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500", bar: "bg-red-500" },
}

const confColor = (s: number) => s >= 80 ? "text-emerald-600 dark:text-emerald-400" : s >= 60 ? "text-amber-600 dark:text-amber-400" : s >= 40 ? "text-orange-600 dark:text-orange-400" : "text-red-600 dark:text-red-400"
const confBar = (s: number) => s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : s >= 40 ? "bg-orange-500" : "bg-red-500"

export function SharedVerdictView({ data }: { data: ShareableVerdict }) {
  const { t } = useLang()
  const config = verdictStyles[data.v]

  const tagline = {
    GO: t("verdict_go_tagline"),
    PIVOT: t("verdict_pivot_tagline"),
    DONT: t("verdict_dont_tagline"),
  }[data.v]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <CouncilMark className="w-5 h-5 text-foreground transition-transform group-hover:scale-110" />
            <span className="text-[15px] font-semibold tracking-tight">Council</span>
          </Link>
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6 py-8">
        <div className="w-full max-w-xl mx-auto space-y-4">
          {/* Verdict card */}
          <div className={`rounded-2xl border ${config.border} ${config.bg} overflow-hidden`}>
            <div className="px-6 pt-6 pb-4">
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                &ldquo;{data.s}&rdquo;
              </p>
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-3 h-3 rounded-full ${config.dot}`} />
                <span className={`text-3xl font-black tracking-tight ${config.text}`}>{config.label}</span>
              </div>
              <p className={`text-sm font-medium ${config.text} opacity-70`}>{tagline}</p>
            </div>

            {/* Confidence */}
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("confidence_label")}</span>
                <span className={`text-sm font-bold tabular-nums ${confColor(data.c)}`}>{data.c}%</span>
              </div>
              <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
                <div className={`h-full rounded-full ${confBar(data.c)} transition-all duration-700`} style={{ width: `${data.c}%` }} />
              </div>
            </div>

            {/* 3 Reasons */}
            <div className="border-t border-foreground/5">
              {data.r.map((reason, i) => (
                <div key={i} className={`px-6 py-4 ${i < 2 ? "border-b border-foreground/5" : ""}`}>
                  <div className="flex gap-3">
                    <span className={`shrink-0 w-6 h-6 rounded-full ${config.bg} ${config.text} flex items-center justify-center text-xs font-bold border ${config.border}`}>{i + 1}</span>
                    <p className="text-sm text-foreground leading-relaxed">{reason}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pivot suggestion */}
            {data.p ? (
              <div className="px-6 py-4 border-t border-foreground/5 bg-foreground/[0.02]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{t("instead_try")}</p>
                <p className="text-sm font-medium text-foreground">{data.p}</p>
              </div>
            ) : null}
          </div>

          {/* CTA */}
          <div className="text-center pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-80 transition-all"
            >
              {t("share_cta")}
            </Link>
            <p className="text-[11px] text-muted-foreground/50 mt-3">
              {t("share_powered_by")}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
