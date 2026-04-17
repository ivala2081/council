"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CouncilMark } from "@/components/council-mark";
import type { DictKey } from "@/lib/i18n";
import { useLang } from "@/lib/i18n";

// ============================================================
// Types
// ============================================================

interface LoadingStep {
  delay: number;
  textKey: DictKey;
}

export const STEPS: LoadingStep[] = [
  { delay: 0, textKey: "loading_step_1" },
  { delay: 3000, textKey: "loading_step_2" },
  { delay: 8000, textKey: "loading_step_3" },
  { delay: 15000, textKey: "loading_step_4" },
  { delay: 25000, textKey: "loading_step_5" },
];

// ============================================================
// Syncing spinner (inspired by AnimatedCardStatusList)
// ============================================================

function SyncSpinner() {
  const [activeDash, setActiveDash] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setActiveDash((prev) => (prev + 1) % 8);
    }, 100);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = index * 45 - 90;
        const radian = (angle * Math.PI) / 180;
        const radius = 6;
        const dashLength = 1.8;
        const startX = 8 + (radius - dashLength / 2) * Math.cos(radian);
        const startY = 8 + (radius - dashLength / 2) * Math.sin(radian);
        const endX = 8 + (radius + dashLength / 2) * Math.cos(radian);
        const endY = 8 + (radius + dashLength / 2) * Math.sin(radian);

        return (
          <line
            key={index}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={index === activeDash ? "currentColor" : "currentColor"}
            strokeOpacity={index === activeDash ? 1 : 0.25}
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

// ============================================================
// Completed check icon
// ============================================================

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="drop-shadow-sm">
      <circle cx="8" cy="8" r="8" fill="#22c55e" />
      <motion.path
        d="M5 8l2.5 2.5 3.5-4"
        stroke="white"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </svg>
  );
}

// ============================================================
// Main component
// ============================================================

interface LoadingStepsProps {
  active: boolean;
  /** When provided, overrides internal timer-based step progression */
  externalStep?: number;
}

export function LoadingSteps({ active, externalStep }: LoadingStepsProps) {
  const [internalStep, setInternalStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const { t } = useLang();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const currentStep = externalStep ?? internalStep;

  useEffect(() => {
    // Skip internal timers when externally controlled
    if (externalStep !== undefined) return;
    if (!active) {
      setInternalStep(0);
      return;
    }
    timersRef.current = STEPS.map((step, i) =>
      setTimeout(() => setInternalStep(i), step.delay)
    );
    return () => timersRef.current.forEach(clearTimeout);
  }, [active, externalStep]);

  if (!active) return null;

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Card container */}
      <motion.div
        className="border border-border/30 rounded-2xl p-5 bg-card/80 backdrop-blur-xl shadow-lg"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
          duration: shouldReduceMotion ? 0.15 : undefined,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-border/20">
          <CouncilMark className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
            Analyzing
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {STEPS.slice(0, currentStep + 1).map((step, i) => {
              const isCompleted = i < currentStep;
              const isCurrent = i === currentStep;

              return (
                <motion.div
                  key={step.textKey}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{
                    opacity: { duration: 0.3, ease: "easeOut" },
                    height: { duration: 0.3, ease: "easeOut" },
                  }}
                  className="relative overflow-hidden"
                >
                  <div
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-300 ${
                      isCurrent
                        ? "bg-muted/50 border border-border/40"
                        : "bg-transparent border border-transparent"
                    }`}
                  >
                    {/* Syncing gradient for active step */}
                    {isCurrent && (
                      <div
                        className="absolute inset-0 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none rounded-lg"
                        style={{
                          backgroundSize: "50% 100%",
                          backgroundPosition: "right",
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                      <AnimatePresence mode="wait">
                        {isCompleted ? (
                          <motion.div
                            key="check"
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                          >
                            <CheckIcon />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="spinner"
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="text-muted-foreground"
                          >
                            <SyncSpinner />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Text */}
                    <span
                      className={`relative text-sm transition-colors duration-300 ${
                        isCompleted
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {t(step.textKey)}
                    </span>

                    {/* Status label */}
                    {isCurrent && i < STEPS.length - 1 && (
                      <span className="ml-auto text-[10px] font-mono font-medium text-muted-foreground/60 tracking-wider">
                        ...
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer estimate */}
        <motion.p
          className="text-[11px] text-muted-foreground/50 mt-4 pt-3 border-t border-border/20 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {t("loading_estimate")}
        </motion.p>
      </motion.div>
    </div>
  );
}
