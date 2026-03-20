// ============================================================
// Error Recovery: Retry, Fallback, Circuit Breaker
// ============================================================

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number[];
  fallbackModels: Record<string, string>;
  circuitBreaker: {
    failureThreshold: number;
    windowMs: number;
    cooldownMs: number;
  };
}

export const RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: [1000, 4000, 16000],
  fallbackModels: {
    "claude-sonnet-4-20250514": "claude-haiku-4-5-20251001",
    "deepseek-v3": "claude-haiku-4-5-20251001",
    "claude-haiku-4-5-20251001": "claude-sonnet-4-20250514",
  },
  circuitBreaker: {
    failureThreshold: 5,
    windowMs: 60_000,
    cooldownMs: 30_000,
  },
};

// --- Circuit Breaker ---
interface CircuitState {
  failures: number[];
  openUntil: number | null;
}

const circuits = new Map<string, CircuitState>();

export function isCircuitOpen(model: string): boolean {
  const state = circuits.get(model);
  if (!state) return false;
  if (state.openUntil && Date.now() < state.openUntil) return true;
  if (state.openUntil && Date.now() >= state.openUntil) {
    // Reset after cooldown
    circuits.delete(model);
    return false;
  }
  return false;
}

export function recordFailure(model: string): void {
  const now = Date.now();
  let state = circuits.get(model);
  if (!state) {
    state = { failures: [], openUntil: null };
    circuits.set(model, state);
  }

  // Only count failures within window
  state.failures = state.failures.filter(
    (t) => now - t < RETRY_CONFIG.circuitBreaker.windowMs
  );
  state.failures.push(now);

  if (state.failures.length >= RETRY_CONFIG.circuitBreaker.failureThreshold) {
    state.openUntil = now + RETRY_CONFIG.circuitBreaker.cooldownMs;
  }
}

export function recordSuccess(model: string): void {
  circuits.delete(model);
}

// --- Retry with Backoff ---
export async function withRetry<T>(
  fn: (model: string) => Promise<T>,
  primaryModel: string,
): Promise<{ result: T; modelUsed: string }> {
  const config = RETRY_CONFIG;
  let lastError: unknown;

  // Try primary model with retries
  if (!isCircuitOpen(primaryModel)) {
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await fn(primaryModel);
        recordSuccess(primaryModel);
        return { result, modelUsed: primaryModel };
      } catch (error) {
        lastError = error;
        recordFailure(primaryModel);

        if (attempt < config.maxRetries) {
          await sleep(config.backoffMs[attempt] ?? 16000);
        }
      }
    }
  }

  // Try fallback model
  const fallback = config.fallbackModels[primaryModel];
  if (fallback && !isCircuitOpen(fallback)) {
    try {
      const result = await fn(fallback);
      recordSuccess(fallback);
      return { result, modelUsed: fallback };
    } catch (error) {
      recordFailure(fallback);
      lastError = error;
    }
  }

  throw new AgentFailureError(
    primaryModel,
    lastError instanceof Error ? lastError.message : String(lastError),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Custom Errors ---
export class AgentFailureError extends Error {
  constructor(
    public readonly model: string,
    public readonly cause: string,
  ) {
    super(`Agent failed on model ${model}: ${cause}`);
    this.name = "AgentFailureError";
  }
}

export class PhaseFailureError extends Error {
  constructor(
    public readonly phase: number,
    public readonly agentName: string,
    public readonly cause: string,
  ) {
    super(`Phase ${phase} failed at agent ${agentName}: ${cause}`);
    this.name = "PhaseFailureError";
  }
}
