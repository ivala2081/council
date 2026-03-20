"use client";

import { useState } from "react";

interface PdfExportButtonProps {
  briefRef: React.RefObject<HTMLElement | null>;
  filename?: string;
  title?: string;
  variant?: "icon" | "button";
}

export function PdfExportButton({
  briefRef,
  filename = "council-brief.pdf",
  title = "Brief",
  variant = "button",
}: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting || !briefRef.current) return;
    setExporting(true);
    try {
      const { generateBriefPdf } = await import("@/lib/pdf/generate-pdf");
      await generateBriefPdf(briefRef.current, filename, title);
    } catch (err) {
      console.error("[pdf] Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
        title="Export PDF"
      >
        {exporting ? (
          <svg className="w-4 h-4 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-40"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      {exporting ? "Exporting..." : "Export PDF"}
    </button>
  );
}
