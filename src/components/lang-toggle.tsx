"use client";

import { useLang } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "tr" : "en")}
      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors text-xs font-medium text-muted-foreground"
      title={lang === "en" ? "Türkçe'ye geç" : "Switch to English"}
    >
      {lang === "en" ? "TR" : "EN"}
    </button>
  );
}
