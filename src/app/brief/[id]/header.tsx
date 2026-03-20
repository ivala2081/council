"use client";

import { ThemeToggle } from "@/components/theme-toggle";

function CouncilMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 7.5C15.5 5.5 13 4.5 10.5 5C7.5 5.5 5.5 8 5.5 11C5.5 14 7.5 16.5 10.5 17C13 17.5 15.5 16.5 17 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 9.5C14 8.5 12.5 8 11 8.5C9.5 9 8.5 10.5 8.5 12C8.5 13.5 9.5 15 11 15.5C12.5 16 14 15.5 15 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" />
      <circle cx="19.5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function BriefPageHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <CouncilMark className="w-5 h-5 text-foreground" />
          <span className="text-sm font-semibold tracking-tight">Council</span>
        </a>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <a
            href="/"
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
            title="New mission"
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
