-- Persistent rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);

-- Atomic check-and-increment function
-- Uses FOR UPDATE row lock for concurrency safety across serverless instances
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 86400
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, resets_at TIMESTAMPTZ) AS $$
DECLARE
  v_entry RECORD;
BEGIN
  -- Try to find existing entry with row lock
  SELECT * INTO v_entry FROM rate_limits rl WHERE rl.key = p_key FOR UPDATE;

  IF v_entry IS NULL THEN
    -- No entry: create new one
    INSERT INTO rate_limits (key, window_start, request_count)
    VALUES (p_key, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      request_count = CASE
        WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL < now()
        THEN 1
        ELSE rate_limits.request_count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL < now()
        THEN now()
        ELSE rate_limits.window_start
      END;
    RETURN QUERY SELECT true, 1, now() + (p_window_seconds || ' seconds')::INTERVAL;
    RETURN;
  END IF;

  -- Check if window expired
  IF v_entry.window_start + (p_window_seconds || ' seconds')::INTERVAL < now() THEN
    UPDATE rate_limits rl SET window_start = now(), request_count = 1 WHERE rl.key = p_key;
    RETURN QUERY SELECT true, 1, now() + (p_window_seconds || ' seconds')::INTERVAL;
    RETURN;
  END IF;

  -- Window active: check limit
  IF v_entry.request_count >= p_max_requests THEN
    RETURN QUERY SELECT false, v_entry.request_count,
      v_entry.window_start + (p_window_seconds || ' seconds')::INTERVAL;
    RETURN;
  END IF;

  -- Increment
  UPDATE rate_limits rl SET request_count = v_entry.request_count + 1 WHERE rl.key = p_key;
  RETURN QUERY SELECT true, v_entry.request_count + 1,
    v_entry.window_start + (p_window_seconds || ' seconds')::INTERVAL;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for expired entries (call periodically via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '25 hours';
END;
$$ LANGUAGE plpgsql;
