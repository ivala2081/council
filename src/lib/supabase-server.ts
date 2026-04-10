import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy Supabase server client — prevents `next build` from crashing at
// module evaluation when env vars are missing. The real client is only
// instantiated when a property (e.g., `.from`) is accessed.

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase env vars not configured");
    }
    _client = createClient(url, key);
  }
  return _client;
}

// Proxy defers client creation until first property access.
// Call sites can keep using `supabase.from(...)` unchanged.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
}) as SupabaseClient;
