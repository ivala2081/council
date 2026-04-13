import { supabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ShareContent } from "./share-content";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: thread } = await supabase
    .from("threads")
    .select("name, latest_verdict, latest_score, run_count")
    .eq("id", id)
    .single();

  if (!thread) return { title: "Not Found" };

  return {
    title: `${thread.name} — Council Journey`,
    description: `Score: ${thread.latest_score ?? "—"} | ${thread.latest_verdict?.toUpperCase() ?? "—"} | ${thread.run_count} runs`,
    openGraph: {
      title: `${thread.name} — Council Journey`,
      description: `Score: ${thread.latest_score ?? "—"} | ${thread.latest_verdict?.toUpperCase() ?? "—"} | ${thread.run_count} runs`,
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  const [threadRes, runsRes] = await Promise.all([
    supabase
      .from("threads")
      .select("id, name, latest_verdict, latest_score, run_count, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("missions")
      .select("id, result, run_number, created_at")
      .eq("thread_id", id)
      .eq("status", "completed")
      .order("run_number", { ascending: true }),
  ]);

  if (!threadRes.data) notFound();

  const scores = (runsRes.data ?? []).map((r) => {
    const v = r.result?.verdict as Record<string, unknown> | undefined;
    return (v?.councilScore as number) ?? 0;
  }).filter((s) => s > 0);

  const verdicts = (runsRes.data ?? []).map((r) => {
    const v = r.result?.verdict as Record<string, unknown> | undefined;
    return (v?.verdict as string) ?? "";
  });

  return (
    <ShareContent
      thread={threadRes.data}
      scores={scores}
      verdicts={verdicts}
      runCount={runsRes.data?.length ?? 0}
    />
  );
}
