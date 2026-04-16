"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EntropyBg } from "@/components/entropy-bg";
import { ThemeToggle } from "@/components/theme-toggle";

const DURATION_OPTIONS = [10, 20, 30, 45, 60];

const FAKE_STEPS = [
  { delay: 0, text: "Fikrin okunuyor..." },
  { delay: 3000, text: "Pazar kontrol ediliyor..." },
  { delay: 8000, text: "Riskler analiz ediliyor..." },
  { delay: 15000, text: "Karar oluşturuluyor..." },
  { delay: 25000, text: "Derin analiz — karmaşık fikirler biraz daha uzun sürer..." },
];

export default function EntropyLab() {
  const [progress, setProgress] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [durationSec, setDurationSec] = useState(30);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!autoPlay) return;
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      setElapsedMs(elapsed);
      const p = Math.min(1, elapsed / (durationSec * 1000));
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoPlay, durationSec]);

  const restart = () => {
    startRef.current = performance.now();
    setElapsedMs(0);
    setProgress(0);
    setAutoPlay(true);
  };

  const handleScrub = (value: number) => {
    setAutoPlay(false);
    setProgress(value);
    setElapsedMs(value * durationSec * 1000);
  };

  const currentStep = FAKE_STEPS.reduce((acc, s, i) => (elapsedMs >= s.delay ? i : acc), 0);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <EntropyBg progress={progress} autoPlayDurationMs={durationSec * 1000} />

      <header className="fixed top-0 left-0 right-0 z-30 bg-background/60 backdrop-blur-xl border-b border-border/20">
        <div className="max-w-3xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">Council</Link>
            <span className="text-xs text-muted-foreground/60">/ entropy lab</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="space-y-3 text-sm">
          {FAKE_STEPS.slice(0, currentStep + 1).map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              {i < currentStep ? (
                <span className="text-emerald-500 w-4 text-center">✓</span>
              ) : (
                <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
              )}
              <span className={i < currentStep ? "text-muted-foreground" : "text-foreground"}>
                {step.text}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-8">~{durationSec} saniye — gerçek veri biraz zaman alır</p>
      </main>

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(520px,calc(100%-2rem))]">
        <div className="bg-card/85 backdrop-blur-xl border border-border/40 rounded-xl p-4 space-y-3 shadow-lg">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground uppercase tracking-wider">Progress</span>
              <span className="tabular-nums text-foreground font-medium">{(progress * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
              className="w-full accent-foreground"
            />
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <button
              onClick={restart}
              className="px-3 py-1.5 rounded-md bg-foreground text-background font-medium hover:opacity-80 transition-all"
            >
              Restart
            </button>
            <button
              onClick={() => setAutoPlay((v) => !v)}
              className="px-3 py-1.5 rounded-md border border-border/60 hover:bg-muted transition-colors"
            >
              {autoPlay ? "Pause" : "Play"}
            </button>
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-muted-foreground">Duration:</span>
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => { setDurationSec(d); restart(); }}
                  className={`px-2 py-1 rounded-md transition-colors ${durationSec === d ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground/60 tabular-nums pt-1 border-t border-border/30">
            <span>t = {(elapsedMs / 1000).toFixed(1)}s</span>
            <span className="mx-2">·</span>
            <span>front = {(progress * 100).toFixed(0)}% of viewport</span>
          </div>
        </div>
      </div>
    </div>
  );
}
