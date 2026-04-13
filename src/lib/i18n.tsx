"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

// ============================================================
// Types
// ============================================================

export type Lang = "en" | "tr";

// ============================================================
// Dictionary
// ============================================================

const dict = {
  // -- Page: Landing --
  headline: {
    en: "Honest verdict on your idea",
    tr: "Fikrine dürüst cevap",
  },
  subheadline: {
    en: "10 seconds, 3 reasons, brutally honest.",
    tr: "10 saniye, 3 sebep, acımasızca dürüst.",
  },
  placeholder: {
    en: "Describe your idea...",
    tr: "Fikrini anlat...",
  },
  submit_button: {
    en: "Get honest verdict",
    tr: "Dürüst cevap al",
  },
  try_label: {
    en: "Try:",
    tr: "Dene:",
  },
  input_hint: {
    en: "Enter to send · Shift+Enter for newline",
    tr: "Enter ile gönder · Shift+Enter yeni satır",
  },
  try_again: {
    en: "Try again",
    tr: "Tekrar dene",
  },

  // -- Page: Loading --
  loading_step_1: {
    en: "Reading your idea...",
    tr: "Fikrin okunuyor...",
  },
  loading_step_2: {
    en: "Checking the market...",
    tr: "Pazar kontrol ediliyor...",
  },
  loading_step_3: {
    en: "Analyzing risks...",
    tr: "Riskler analiz ediliyor...",
  },
  loading_step_4: {
    en: "Building the verdict...",
    tr: "Karar oluşturuluyor...",
  },
  loading_step_5: {
    en: "Deep analysis — complex ideas take longer...",
    tr: "Derin analiz — karmaşık fikirler biraz daha uzun sürer...",
  },

  // -- Page: Verdict --
  council_heard: {
    en: "Council heard",
    tr: "Council şunu anladı",
  },
  not_quite: {
    en: "Not quite?",
    tr: "Tam değil mi?",
  },
  try_another: {
    en: "Try another idea",
    tr: "Başka bir fikir dene",
  },
  new_idea_tooltip: {
    en: "New idea",
    tr: "Yeni fikir",
  },

  // -- VerdictCard: Verdict labels --
  verdict_go_tagline: {
    en: "Do it.",
    tr: "Yap.",
  },
  verdict_pivot_tagline: {
    en: "Change one thing.",
    tr: "Bir şeyi değiştir.",
  },
  verdict_dont_tagline: {
    en: "Walk away.",
    tr: "Vazgeç.",
  },
  confidence_label: {
    en: "Confidence",
    tr: "Güven",
  },

  // -- VerdictCard: Drill-down --
  show_details: {
    en: "Show evidence details",
    tr: "Kanıt detaylarını göster",
  },
  hide_details: {
    en: "Hide details",
    tr: "Detayları gizle",
  },
  instead_try: {
    en: "Instead, try this",
    tr: "Bunun yerine bunu dene",
  },

  // -- VerdictCard: Financials --
  financials_title: {
    en: "Financials",
    tr: "Finansal",
  },
  mvp_cost: {
    en: "MVP Cost",
    tr: "MVP Maliyet",
  },
  breakeven: {
    en: "Breakeven",
    tr: "Başabaş",
  },
  suggested_price: {
    en: "Suggested Price",
    tr: "Önerilen Fiyat",
  },
  business_model: {
    en: "Model",
    tr: "Model",
  },

  // -- VerdictCard: Tech Snapshot --
  tech_title: {
    en: "Tech Snapshot",
    tr: "Teknik Özet",
  },
  stack: {
    en: "Stack",
    tr: "Stack",
  },
  complexity: {
    en: "Complexity",
    tr: "Karmaşıklık",
  },
  mvp_timeline: {
    en: "MVP Timeline",
    tr: "MVP Süre",
  },
  weeks: {
    en: "weeks",
    tr: "hafta",
  },
  users: {
    en: "users",
    tr: "kullanıcı",
  },

  // -- VerdictCard: Legal --
  legal_title: {
    en: "Legal Flags",
    tr: "Yasal Riskler",
  },

  // -- VerdictCard: Share --
  copy_link: {
    en: "Copy link",
    tr: "Link kopyala",
  },
  copied: {
    en: "Copied!",
    tr: "Kopyalandı!",
  },
  tweet: {
    en: "Share on X",
    tr: "X'te Paylaş",
  },

  // -- Evidence type labels --
  evidence_market_data: { en: "Market", tr: "Pazar" },
  evidence_competitor: { en: "Competitor", tr: "Rakip" },
  evidence_financial: { en: "Financial", tr: "Finansal" },
  evidence_technical: { en: "Technical", tr: "Teknik" },
  evidence_legal: { en: "Legal", tr: "Yasal" },
  evidence_pattern: { en: "Pattern", tr: "Örüntü" },
  evidence_training_data: { en: "Known data", tr: "Bilinen veri" },
  evidence_assumption: { en: "Assumption", tr: "Varsayım" },

  // -- Share page --
  share_cta: {
    en: "Get your own verdict",
    tr: "Kendi fikrine cevap al",
  },
  share_powered_by: {
    en: "Powered by Council — AI that tells the truth about your idea",
    tr: "Council — fikrine kimsenin söylemediği gerçeği söyleyen AI",
  },

  // -- Feedback --
  feedback_helpful: {
    en: "Was this helpful?",
    tr: "Bu faydalı oldu mu?",
  },
  feedback_thanks: {
    en: "Thanks for the feedback!",
    tr: "Geri bildirim için teşekkürler!",
  },
  feedback_comment_placeholder: {
    en: "Any thoughts? (optional)",
    tr: "Düşüncen var mı? (isteğe bağlı)",
  },
  feedback_send: {
    en: "Send",
    tr: "Gönder",
  },

  // -- History --
  history_title: {
    en: "Your past verdicts",
    tr: "Geçmiş kararların",
  },
  history_empty: {
    en: "No verdicts yet",
    tr: "Henüz karar yok",
  },
  history_re_evaluate: {
    en: "Re-evaluate",
    tr: "Tekrar değerlendir",
  },
  history_view: {
    en: "View",
    tr: "Görüntüle",
  },
  history_clear: {
    en: "Clear history",
    tr: "Geçmişi temizle",
  },
  history_clear_confirm: {
    en: "Are you sure?",
    tr: "Emin misin?",
  },
  history_ago: {
    en: "ago",
    tr: "önce",
  },

  // -- Landing: Value Proposition --
  value_prop_1: {
    en: "Real market data",
    tr: "Gerçek pazar verisi",
  },
  value_prop_1_desc: {
    en: "Live web search, not guesswork",
    tr: "Canlı web araması, tahmin değil",
  },
  value_prop_2: {
    en: "3 evidence-backed reasons",
    tr: "3 kanıta dayalı sebep",
  },
  value_prop_2_desc: {
    en: "Every claim has a source",
    tr: "Her iddia kaynağıyla",
  },
  value_prop_3: {
    en: "Brutally honest",
    tr: "Acımasızca dürüst",
  },
  value_prop_3_desc: {
    en: "No sugarcoating, no jargon",
    tr: "Laf kalabalığı yok",
  },
  loading_estimate: {
    en: "~30 seconds — real data takes a moment",
    tr: "~30 saniye — gerçek veri biraz zaman alır",
  },
  footer_open_source: {
    en: "Open source",
    tr: "Açık kaynak",
  },
  footer_built_with: {
    en: "Built with Claude",
    tr: "Claude ile yapıldı",
  },

  // -- Re-evaluation --
  re_eval_badge: {
    en: "Re-evaluation",
    tr: "Tekrar değerlendirme",
  },
  re_eval_previous: {
    en: "Previous verdict",
    tr: "Önceki karar",
  },
} as const;

export type DictKey = keyof typeof dict;

// ============================================================
// Context + Hook
// ============================================================

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}>({
  lang: "en",
  setLang: () => {},
  t: (key) => dict[key]?.en ?? key,
});

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("council-lang");
  if (saved === "en" || saved === "tr") return saved;
  const browser = navigator.language?.toLowerCase() ?? "";
  return browser.startsWith("tr") ? "tr" : "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  // Always start with "en" on server to avoid hydration mismatch.
  // Client detects actual language after mount via useEffect.
  const [lang, setLangState] = useState<Lang>("en");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLangState(detectLang()) }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("council-lang", l);
  };

  const t = (key: DictKey): string => {
    return dict[key]?.[lang] ?? dict[key]?.en ?? key;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
