"use client";

import { useState } from "react";
import {
  FileText,
  Database,
  Plug,
  Component,
  TestTube,
  Settings,
  Palette,
  X,
} from "lucide-react";

interface ArtifactFile {
  file_path: string;
  language: string;
  phase: number;
  agent_name: string;
  content: string;
}

interface ArtifactWallProps {
  files: ArtifactFile[];
  totalEstimate: number;
  isBuilding: boolean;
}

function getCategory(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const name = filePath.toLowerCase();

  if (name.includes("test") || name.includes("spec"))
    return { icon: TestTube, label: "Test", color: "text-purple-500" };
  if (ext === "sql" || ext === "prisma" || name.includes("schema"))
    return { icon: Database, label: "Schema", color: "text-blue-500" };
  if (name.includes("route") || name.includes("api"))
    return { icon: Plug, label: "API", color: "text-green-500" };
  if (ext === "tsx" || ext === "jsx")
    return { icon: Component, label: "Component", color: "text-cyan-500" };
  if (ext === "css" || ext === "scss")
    return { icon: Palette, label: "Style", color: "text-pink-500" };
  if (ext === "json" || ext === "yaml" || ext === "env" || ext === "toml")
    return { icon: Settings, label: "Config", color: "text-amber-500" };
  return { icon: FileText, label: "Doc", color: "text-muted-foreground" };
}

export function ArtifactWall({
  files,
  totalEstimate,
  isBuilding,
}: ArtifactWallProps) {
  const [selected, setSelected] = useState<ArtifactFile | null>(null);
  const total = Math.max(totalEstimate, files.length);
  const remaining = total - files.length;

  return (
    <div data-slot="artifact-wall">
      {/* Counter bar */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Artifact Wall — {files.length}/{total}
        </h3>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-foreground/30 rounded-full transition-all duration-500"
          style={{ width: `${(files.length / total) * 100}%` }}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {files.map((file, i) => {
          const cat = getCategory(file.file_path);
          const Icon = cat.icon;
          return (
            <button
              key={i}
              onClick={() => setSelected(file)}
              className="aspect-square rounded-lg border bg-card hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-1 group artifact-pop"
              title={file.file_path}
            >
              <Icon className={`w-4 h-4 ${cat.color}`} />
              <span className="text-[8px] text-muted-foreground truncate max-w-full px-0.5">
                {file.file_path.split("/").pop()?.slice(0, 8)}
              </span>
            </button>
          );
        })}

        {/* Pending placeholders */}
        {isBuilding &&
          Array.from({ length: Math.min(remaining, 6) }).map((_, i) => (
            <div
              key={`p-${i}`}
              className="aspect-square rounded-lg border border-dashed bg-muted/10 flex items-center justify-center animate-pulse"
            >
              <div className="w-3 h-3 rounded bg-muted/30" />
            </div>
          ))}
      </div>

      {/* Empty state */}
      {files.length === 0 && !isBuilding && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Artifacts will appear as Council builds your product.
        </p>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[80vh] rounded-xl border bg-card shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-mono text-foreground truncate">
                {selected.file_path}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="overflow-auto p-4 text-xs font-mono text-foreground/80 leading-relaxed flex-1">
              {selected.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
