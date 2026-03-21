"use client";

import { useState, useEffect } from "react";

interface Section {
  id: string;
  label: string;
  visible: boolean;
}

export function ThreadSectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const visibleSections = sections.filter((s) => s.visible);
    if (visibleSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            history.replaceState(null, "", `#${entry.target.id}`);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    for (const section of visibleSections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  const visibleSections = sections.filter((s) => s.visible);
  if (visibleSections.length < 2) return null;

  return (
    <nav
      data-slot="thread-section-nav"
      className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-2"
    >
      {visibleSections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`group flex items-center gap-2 transition-all ${
            active === section.id ? "opacity-100" : "opacity-40 hover:opacity-70"
          }`}
          title={section.label}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              active === section.id
                ? "bg-foreground scale-125"
                : "bg-muted-foreground"
            }`}
          />
          <span className="text-[10px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {section.label}
          </span>
        </a>
      ))}
    </nav>
  );
}
