import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import {
  strategicBriefSchema,
  conciseBriefSchema,
} from "@/lib/agents/types";
import type { Metadata } from "next";
import { BriefPageHeader } from "./header";
import { BriefContent } from "./brief-content";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabase
    .from("missions")
    .select("result, prompt")
    .eq("id", id)
    .eq("status", "completed")
    .single();

  if (!data?.result) {
    return { title: "Brief Not Found — Council" };
  }

  const verdictObj = data.result?.verdict ?? data.result?.executiveSummary;
  const verdict = verdictObj?.verdict ?? "Brief";
  const score = verdictObj?.councilScore ?? "";
  const summary = verdictObj?.summary ?? "";

  return {
    title: `${verdict.toUpperCase()} ${score}/100 — Council`,
    description: summary.slice(0, 160),
    openGraph: {
      title: `Council Brief: ${verdict.toUpperCase()} ${score}/100`,
      description: summary.slice(0, 160),
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `Council Brief: ${verdict.toUpperCase()} ${score}/100`,
      description: summary.slice(0, 160),
    },
  };
}

export default async function BriefPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const { data: mission, error } = await supabase
    .from("missions")
    .select("id, prompt, result, pipeline_mode, created_at, total_cost_usd")
    .eq("id", id)
    .eq("status", "completed")
    .single();

  if (error || !mission?.result) {
    notFound();
  }

  const isConcise = mission.pipeline_mode === "concise";

  const fullResult = !isConcise
    ? strategicBriefSchema.safeParse(mission.result)
    : null;
  const conciseResult = isConcise
    ? conciseBriefSchema.safeParse(mission.result)
    : null;

  if (!fullResult?.success && !conciseResult?.success) {
    notFound();
  }

  const createdAt = new Date(mission.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const verdictObj = mission.result?.verdict ?? mission.result?.executiveSummary;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${((verdictObj as Record<string, unknown>)?.verdict as string)?.toUpperCase() ?? "Brief"} ${(verdictObj as Record<string, unknown>)?.councilScore ?? ""}/100 — Council Brief`,
    description: ((verdictObj as Record<string, unknown>)?.summary as string)?.slice(0, 160) ?? "",
    datePublished: mission.created_at,
    publisher: {
      "@type": "Organization",
      name: "Council",
      url: "https://council-zeta.vercel.app",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BriefPageHeader />
      <BriefContent
        brief={fullResult?.success ? fullResult.data : undefined}
        conciseBrief={conciseResult?.success ? conciseResult.data : undefined}
        isConcise={isConcise}
        prompt={mission.prompt}
        createdAt={createdAt}
      />
    </div>
  );
}
