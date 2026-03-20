"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  current_phase: number;
  complexity_class: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  product: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  design: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  building: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  verifying: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  releasing: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  live: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  paused: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ownerToken = localStorage.getItem("council_owner_token");
    if (!ownerToken) {
      setLoading(false);
      return;
    }

    fetch(`/api/projects?owner_token=${ownerToken}`)
      .then((r) => r.json())
      .then((json) => setProjects(json.projects ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 bg-background/95 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-muted-foreground hover:text-foreground text-sm">← Council</a>
            <span className="font-semibold text-sm">Projects</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Your Projects</h1>
          <Badge variant="outline" className="font-mono text-xs">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </Badge>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : projects.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <p className="text-muted-foreground">No projects yet.</p>
            <p className="text-sm text-muted-foreground">
              Open a Council thread and click <strong>Build</strong> to start.
            </p>
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground underline">
              Go to Council →
            </a>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <a key={project.id} href={`/build/${project.id}`} className="block group">
                <Card className="p-4 hover:border-foreground/20 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold truncate group-hover:text-foreground transition-colors">
                          {project.name}
                        </h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] ?? STATUS_COLORS.intake}`}>
                          {project.status}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground shrink-0">
                      <span>Phase {project.current_phase}/6</span>
                      <span>{formatDate(project.created_at)}</span>
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
