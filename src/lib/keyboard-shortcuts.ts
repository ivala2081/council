/**
 * Global keyboard shortcuts for desktop power users.
 */

export interface Shortcut {
  key: string;
  meta: boolean; // Cmd/Ctrl
  action: string;
  handler: () => void;
}

export function setupShortcuts(shortcuts: Shortcut[]): () => void {
  function handleKeyDown(e: KeyboardEvent) {
    // Disabled on mobile (no keyboard)
    if (window.innerWidth < 768) return;

    // Allow Cmd+Enter in inputs
    const isInput =
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement;

    if (isInput && !(e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
      return;
    }

    for (const shortcut of shortcuts) {
      const metaMatch = shortcut.meta
        ? e.metaKey || e.ctrlKey
        : !e.metaKey && !e.ctrlKey;
      if (metaMatch && e.key.toLowerCase() === shortcut.key.toLowerCase()) {
        e.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}
