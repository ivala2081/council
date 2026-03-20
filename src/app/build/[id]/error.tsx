"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BuildError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-6 space-y-4 text-center">
        <p className="text-2xl">⚠</p>
        <h2 className="font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred during the build process."}
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => (window.location.href = "/projects")}>
            Back to Projects
          </Button>
          <Button onClick={reset}>Try Again</Button>
        </div>
      </Card>
    </div>
  );
}
