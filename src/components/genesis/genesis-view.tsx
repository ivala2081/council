"use client";

import { useState, useEffect, useCallback } from "react";
import { ChapterView } from "./chapter";
import { ArtifactWall } from "./artifact-wall";
import { LoadingDots } from "@/components/loading-dots";
import { buildChapters, type Chapter } from "@/lib/genesis/narrative-builder";

interface GenesisViewProps {
  projectId: string;
}

interface ProjectData {
  project: {
    id: string;
    status: string;
    current_phase: number;
  };
  phaseOutputs: Array<{
    phase: number;
    agent_name: string;
    output: Record<string, unknown>;
  }>;
  files: Array<{
    file_path: string;
    language: string;
    phase: number;
    agent_name: string;
    content: string;
  }>;
}

export function GenesisView({ projectId }: GenesisViewProps) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);

      const built = buildChapters(
        json.project.current_phase,
        json.phaseOutputs ?? [],
        json.project.status
      );
      setChapters(built);
    } catch {
      setError("Failed to load Genesis data");
    }
  }, [projectId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Stop polling when done
  useEffect(() => {
    if (
      data?.project.status === "completed" ||
      data?.project.status === "failed"
    ) {
      // Polling will stop on next cleanup
    }
  }, [data?.project.status]);

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 text-sm font-medium text-foreground hover:opacity-70 transition-opacity"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">
          Loading Genesis
          <LoadingDots />
        </p>
      </div>
    );
  }

  const isRunning = data.project.status === "building";

  return (
    <div data-slot="genesis-view" className="flex flex-col gap-6">
      {/* Chapter timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />

        <div className="flex flex-col gap-4">
          {chapters.map((chapter) => (
            <ChapterView
              key={chapter.number}
              chapter={chapter}
              isActive={chapter.status === "running"}
            />
          ))}
        </div>
      </div>

      {/* Artifact Wall */}
      {(data.files?.length ?? 0) > 0 && (
        <ArtifactWall
          files={data.files}
          totalEstimate={estimateTotal(data.project.current_phase)}
          isBuilding={isRunning}
        />
      )}
    </div>
  );
}

function estimateTotal(currentPhase: number): number {
  // Rough estimate based on typical output
  const perPhase = [0, 1, 5, 10, 20, 5, 6];
  return perPhase.slice(0, currentPhase + 2).reduce((a, b) => a + b, 0);
}
