"use client";

import { CouncilMark } from "./council-mark";

interface CouncilErrorProps {
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  }>;
}

export function CouncilError({ title, message, actions }: CouncilErrorProps) {
  return (
    <div
      data-slot="council-error"
      className="flex flex-col items-center justify-center gap-6 rounded-xl border bg-card p-8 text-center"
    >
      <CouncilMark className="h-8 w-8" />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          {message}
        </p>
      </div>
      {actions && actions.length > 0 && (
        <div className="flex gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={
                action.variant === "secondary"
                  ? "rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  : "rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
