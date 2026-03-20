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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "live":
      return "bg-status-success/15 text-status-success";
    case "failed":
      return "bg-status-error/15 text-status-error";
    case "paused":
      return "bg-status-warning/15 text-status-warning";
    case "building":
    case "verifying":
    case "releasing":
      return "bg-status-info/15 text-status-info";
    default:
      return "bg-muted text-muted-foreground";
  }
}

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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(project.status)}`}>
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
