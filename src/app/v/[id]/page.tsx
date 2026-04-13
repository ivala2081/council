import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { decodeVerdict } from "@/lib/verdict-share"
import { SharedVerdictView } from "./shared-verdict-view"

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const data = decodeVerdict(id)
  if (!data) return { title: "Council — Verdict Not Found" }

  const verdictLabel = data.v === "DONT" ? "DON'T" : data.v
  return {
    title: `Council says ${verdictLabel} — ${data.s}`,
    description: data.r[0],
    openGraph: {
      title: `Council says ${verdictLabel}`,
      description: data.s,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Council says ${verdictLabel}`,
      description: data.s,
    },
  }
}

export default async function SharedVerdictPage({ params }: { params: Params }) {
  const { id } = await params
  const data = decodeVerdict(id)
  if (!data) notFound()

  return <SharedVerdictView data={data} />
}
