"use client";

import Link from "next/link";
import { CouncilMark } from "@/components/council-mark";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <CouncilMark className="h-10 w-10" />
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">
            This page doesn&apos;t exist
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Let&apos;s get you back on track.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Go to Council
        </Link>
      </div>
    </div>
  );
}
