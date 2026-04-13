// ============================================================
// localStorage helpers — typed, safe, bounded
// ============================================================

export interface FeedbackEntry {
  verdictId: string
  rating: "up" | "down"
  comment?: string
  timestamp: number
}

export interface HistoryEntry {
  id: string              // encoded verdict ID
  idea: string            // user's original input (first 100 chars)
  verdict: "GO" | "PIVOT" | "DONT"
  confidence: number
  ideaSummary: string
  timestamp: number
}

const FEEDBACK_KEY = "council-feedback"
const HISTORY_KEY = "council-history"
const MAX_HISTORY = 20

function readJSON<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeJSON<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Private browsing or quota exceeded — silently fail
  }
}

// ---- Feedback ----

export function saveFeedback(entry: FeedbackEntry): void {
  const items = readJSON<FeedbackEntry>(FEEDBACK_KEY)
  // Replace if same verdictId exists (user changed their mind)
  const filtered = items.filter(f => f.verdictId !== entry.verdictId)
  filtered.unshift(entry)
  writeJSON(FEEDBACK_KEY, filtered)
}

export function getFeedback(verdictId: string): FeedbackEntry | null {
  const items = readJSON<FeedbackEntry>(FEEDBACK_KEY)
  return items.find(f => f.verdictId === verdictId) ?? null
}

// ---- History ----

export function addToHistory(entry: HistoryEntry): void {
  const items = readJSON<HistoryEntry>(HISTORY_KEY)
  // Prevent duplicates (same encoded ID)
  const filtered = items.filter(h => h.id !== entry.id)
  filtered.unshift(entry)
  writeJSON(HISTORY_KEY, filtered.slice(0, MAX_HISTORY))
}

export function getHistory(): HistoryEntry[] {
  return readJSON<HistoryEntry>(HISTORY_KEY)
}

export function clearHistory(): void {
  writeJSON(HISTORY_KEY, [])
}
