"use client";

import { useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview as SandpackPreviewPane,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Code, FolderTree } from "lucide-react";

interface GeneratedFile {
  file_path: string;
  content: string;
  language: string;
}

// Default package.json for Sandpack Nodebox (Next.js 14 for compatibility)
const DEFAULT_PACKAGE_JSON = JSON.stringify(
  {
    name: "generated-app",
    private: true,
    scripts: {
      dev: "NEXT_TELEMETRY_DISABLED=1 next dev",
      build: "next build",
      start: "next start",
    },
    dependencies: {
      next: "14.2.21",
      react: "18.3.1",
      "react-dom": "18.3.1",
      "@next/swc-wasm-nodejs": "14.2.21",
    },
  },
  null,
  2,
);

function convertFiles(
  files: GeneratedFile[],
): Record<string, { code: string }> {
  const sandpackFiles: Record<string, { code: string }> = {};

  for (const file of files) {
    // Sandpack expects paths starting with /
    const path = file.file_path.startsWith("/")
      ? file.file_path
      : `/${file.file_path}`;
    sandpackFiles[path] = { code: file.content };
  }

  // Ensure package.json exists with Nodebox-compatible deps
  if (!sandpackFiles["/package.json"]) {
    sandpackFiles["/package.json"] = { code: DEFAULT_PACKAGE_JSON };
  } else {
    // Patch existing package.json: inject @next/swc-wasm-nodejs for Nodebox
    try {
      const pkg = JSON.parse(sandpackFiles["/package.json"].code);
      if (pkg.dependencies?.next && !pkg.dependencies["@next/swc-wasm-nodejs"]) {
        pkg.dependencies["@next/swc-wasm-nodejs"] = "14.2.21";
        pkg.dependencies.next = "14.2.21";
        pkg.dependencies.react = "18.3.1";
        pkg.dependencies["react-dom"] = "18.3.1";
      }
      // Ensure dev script disables telemetry
      if (pkg.scripts?.dev && !pkg.scripts.dev.includes("NEXT_TELEMETRY_DISABLED")) {
        pkg.scripts.dev = `NEXT_TELEMETRY_DISABLED=1 ${pkg.scripts.dev}`;
      }
      sandpackFiles["/package.json"] = { code: JSON.stringify(pkg, null, 2) };
    } catch {
      // If package.json is malformed, use default
      sandpackFiles["/package.json"] = { code: DEFAULT_PACKAGE_JSON };
    }
  }

  // Ensure layout.js exists for App Router
  if (!sandpackFiles["/src/app/layout.tsx"] && !sandpackFiles["/src/app/layout.js"] && !sandpackFiles["/app/layout.tsx"] && !sandpackFiles["/app/layout.js"]) {
    const layoutPath = sandpackFiles["/src/app/page.tsx"] || sandpackFiles["/src/app/page.js"]
      ? "/src/app/layout.tsx"
      : "/app/layout.tsx";
    sandpackFiles[layoutPath] = {
      code: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
    };
  }

  return sandpackFiles;
}

function findEntryFile(files: Record<string, { code: string }>): string {
  const candidates = [
    "/src/app/page.tsx",
    "/src/app/page.js",
    "/app/page.tsx",
    "/app/page.js",
    "/pages/index.tsx",
    "/pages/index.js",
  ];
  for (const candidate of candidates) {
    if (files[candidate]) return candidate;
  }
  // Fallback: first .tsx or .ts file
  const firstTsx = Object.keys(files).find(
    (p) => p.endsWith(".tsx") || p.endsWith(".ts"),
  );
  return firstTsx ?? "/app/page.tsx";
}

type ViewMode = "preview" | "code" | "split";

export function ProjectPreview({ files }: { files: GeneratedFile[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [showExplorer, setShowExplorer] = useState(false);

  if (files.length === 0) return null;

  const sandpackFiles = convertFiles(files);
  const entryFile = findEntryFile(sandpackFiles);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-medium">Live Preview</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant={showExplorer ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setShowExplorer(!showExplorer)}
          >
            <FolderTree className="mr-1 h-3.5 w-3.5" />
            Files
          </Button>
          <Button
            variant={viewMode === "code" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setViewMode("code")}
          >
            <Code className="mr-1 h-3.5 w-3.5" />
            Code
          </Button>
          <Button
            variant={viewMode === "preview" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setViewMode("preview")}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            variant={viewMode === "split" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setViewMode("split")}
          >
            Split
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <SandpackProvider
          files={sandpackFiles}
          customSetup={{
            environment: "node",
            entry: entryFile,
          }}
          options={{
            autoReload: true,
            recompileMode: "delayed",
            recompileDelay: 500,
          }}
          theme="dark"
        >
          <SandpackLayout
            style={{
              borderRadius: "0 0 var(--radius) var(--radius)",
              border: "none",
              minHeight: "500px",
            }}
          >
            {showExplorer && <SandpackFileExplorer style={{ height: "500px" }} />}
            {(viewMode === "code" || viewMode === "split") && (
              <SandpackCodeEditor
                showTabs
                showLineNumbers
                style={{ height: "500px" }}
                readOnly
              />
            )}
            {(viewMode === "preview" || viewMode === "split") && (
              <SandpackPreviewPane
                showRefreshButton
                showRestartButton
                style={{ height: "500px" }}
              />
            )}
          </SandpackLayout>
        </SandpackProvider>
      </CardContent>
    </Card>
  );
}
