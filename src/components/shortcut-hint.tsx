"use client";

import { useEffect, useState } from "react";

export function ShortcutHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on desktop
    if (window.innerWidth < 768) return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 hidden md:flex items-center gap-2 text-[10px] text-muted-foreground/40">
      <kbd className="px-1.5 py-0.5 rounded border bg-muted/30 font-mono">
        {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+K
      </kbd>
      <span>Quick actions</span>
    </div>
  );
}
