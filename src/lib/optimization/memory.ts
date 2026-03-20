// ============================================================
// Phase 4: Memory Compaction
// ============================================================
// For returning companies, inject compressed key_findings
// instead of full mission history. Max 5 items, 1500 token cap.
// Aligns with key_findings table in 001_initial.sql.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const MAX_FINDINGS = 5;
const MAX_CHARS = 6000; // ~1500 tokens at 4 chars/token
const STALENESS_DAYS = 90;

interface KeyFinding {
  content: string;
  section: string;
  finding_type: string;
  created_at: string;
}

/**
 * Fetch and compact key findings for a company.
 * Returns a context string to prepend to the user prompt,
 * or null if no previous findings exist.
 */
export async function getCompactedMemory(
  companyId: string
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: findings, error } = await supabase
    .from("key_findings")
    .select("content, section, finding_type, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(MAX_FINDINGS);

  if (error || !findings || findings.length === 0) return null;

  const now = Date.now();
  const staleThreshold = now - STALENESS_DAYS * 24 * 60 * 60 * 1000;

  const lines: string[] = [];
  let totalChars = 0;

  for (const finding of findings as KeyFinding[]) {
    const isStale = new Date(finding.created_at).getTime() < staleThreshold;
    const prefix = isStale ? "[OLDER CONTEXT] " : "";
    const line = `${prefix}[${finding.section}] ${finding.content}`;

    if (totalChars + line.length > MAX_CHARS) break;

    lines.push(`- ${line}`);
    totalChars += line.length;
  }

  if (lines.length === 0) return null;

  return [
    "## PREVIOUS ANALYSIS CONTEXT (from earlier missions for this company)",
    "Use these findings as background. Do NOT repeat them — build on them.",
    ...lines,
  ].join("\n");
}

/**
 * Fetch the most recent completed brief for a company.
 * Used for incremental updates (Phase 3).
 */
export async function getPreviousBrief(
  companyId: string
): Promise<Record<string, unknown> | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("missions")
    .select("result")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data?.result) return null;
  return data.result as Record<string, unknown>;
}
