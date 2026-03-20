"use client";

import { useRef } from "react";
import { BriefView } from "@/components/brief-view";
import { ConciseBriefView } from "@/components/concise-brief-view";
import { PdfExportButton } from "@/components/pdf-export-button";
import type { StrategicBrief, ConciseBrief } from "@/lib/agents/types";

interface BriefContentProps {
  brief?: StrategicBrief;
  conciseBrief?: ConciseBrief;
  isConcise: boolean;
  prompt?: string;
  createdAt: string;
  threadName?: string;
}

export function BriefContent({
  brief,
  conciseBrief,
  isConcise,
  prompt,
  createdAt,
  threadName,
}: BriefContentProps) {
  const briefRef = useRef<HTMLDivElement>(null);

  const verdict = brief?.verdict?.verdict ?? conciseBrief?.verdict?.verdict ?? "brief";
  const score = brief?.verdict?.councilScore ?? conciseBrief?.verdict?.councilScore ?? 0;
  const pdfFilename = `council-${verdict}-${score}.pdf`;
  const pdfTitle = threadName ?? `${verdict.toUpperCase()} ${score}/100`;

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Generated on {createdAt}</p>
          {isConcise && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-1 inline-block">
              Decisions Only
            </span>
          )}
        </div>
        <PdfExportButton
          briefRef={briefRef}
          filename={pdfFilename}
          title={pdfTitle}
        />
      </div>

      {prompt && (
        <details className="mb-6 group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            View original prompt
          </summary>
          <div className="mt-2 p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap border border-border/50">
            {prompt}
          </div>
        </details>
      )}

      <div ref={briefRef}>
        {brief && <BriefView brief={brief} />}
        {conciseBrief && <ConciseBriefView brief={conciseBrief} />}
      </div>
    </main>
  );
}
