import type { V2Verdict } from "@/lib/agents/types";

export const MOCK_VERDICT: V2Verdict = {
  verdict: "GO",
  idea_summary: "AI that reads legal contracts for freelancers",
  reasons: [
    {
      text: "Freelance market up 40% YoY — rising pain, rising budgets",
      evidence: { type: "market_data", source: "Upwork 2025 freelancer report", detail: "40% growth in contract volume" },
    },
    {
      text: "Comparable tools (Ironclad, Juro) charge $20-50/mo — willingness to pay proven",
      evidence: { type: "competitor", source: "https://ironcladapp.com/pricing", detail: "$20-50/mo per seat" },
    },
    {
      text: "MVP is shippable solo — no moat required to start",
      evidence: { type: "technical", detail: "single-dev scope, 4-6 weeks to working demo" },
    },
  ],
  confidence: { score: 78, label: "high" },
  tone_check: { is_brutal_honest: true, is_respectful: true, avoids_jargon: true },
  shareable: {
    card_title: "Council verdict: GO (78%)",
    card_subtitle: "AI that reads legal contracts for freelancers",
    tweet: "Council says GO (78%) on my idea — AI that reads legal contracts for freelancers.",
  },
};
