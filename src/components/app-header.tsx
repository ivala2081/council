"use client";

import { CouncilMark } from "@/components/council-mark";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppHeaderProps {
  children?: React.ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 group">
          <CouncilMark className="w-5 h-5 text-foreground transition-transform group-hover:scale-110" />
          <span className="text-[15px] font-semibold tracking-tight">Council</span>
        </a>
        <div className="flex items-center gap-1">
          {children}
          <a
            href="/projects"
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
            title="Projects"
          >
            <svg className="w-[18px] h-[18px] text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </a>
          <ThemeToggle />
          <a
            href="/"
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
            title="New thread"
          >
            <svg className="w-[18px] h-[18px] text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
