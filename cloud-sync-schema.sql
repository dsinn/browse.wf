-- ============================================
-- Database Schema for Cloud Sync
-- ============================================
-- This SQL script sets up the database schema for the OPTIONAL cloud sync feature.
-- Cloud sync is not required - the app works perfectly fine using only localStorage.
--
-- For setup instructions, see the "Cloud Sync (Optional)" section in README.md
--
-- To run this script:
-- 1. Create a database project (see README for provider options)
-- 2. Go to the SQL Editor in your database dashboard
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute

-- ============================================
-- Single User Data Table
-- ============================================
-- Note: If you get "Invalid schema: public" errors, your database may be configured
-- to use the "api" schema instead. Change "public" to "api" throughout this file.
CREATE TABLE user_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Profile request rate limiting (used by the front proxy Cloudflare Worker)
  -- next_profile_request_available_at: the earliest time the next fetch is permitted
  next_profile_request_available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  profile_request_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- Optional: Index for common queries
-- ============================================
-- Only add if you need to query specific fields
CREATE INDEX idx_user_data_language ON user_data ((data->>'language'));

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data using secure Supabase UUID
CREATE POLICY "Users can view own data"
  ON user_data FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (user_id = auth.uid());

-- Optional: DELETE policy (no UI implemented, but allows manual deletion if needed)
CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- Automatic timestamp update trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Profile Request Rate Limiting
-- ============================================
-- Atomic rate limit check + counter increment, callable via Supabase RPC.
-- Returns { "allowed": bool, "next_fetch_available_at": "<ISO 8601>" }.
-- Called by the front proxy (Cloudflare Worker) using the service role key.
CREATE OR REPLACE FUNCTION try_profile_request(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_available TIMESTAMPTZ;
  v_now            TIMESTAMPTZ := now();
  v_new_next       TIMESTAMPTZ := v_now + INTERVAL '23 hours';
BEGIN
  -- Advisory lock serializes all concurrent calls for the same user, including the
  -- insert-new-row path where FOR UPDATE alone can't lock a non-existent row.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT next_profile_request_available_at
  INTO v_next_available
  FROM user_data
  WHERE user_id = p_user_id
  FOR UPDATE;  -- still held for clarity; advisory lock already serializes

  IF NOT FOUND THEN
    -- First-ever request: insert a new row (user may not have synced yet)
    INSERT INTO user_data (user_id, next_profile_request_available_at, profile_request_count)
    VALUES (p_user_id, v_new_next, 1);
    RETURN jsonb_build_object('allowed', true, 'next_fetch_available_at', v_new_next);
  END IF;

  -- Deny if the cooldown has not yet expired
  IF v_now < v_next_available THEN
    RETURN jsonb_build_object('allowed', false, 'next_fetch_available_at', v_next_available);
  END IF;

  -- Allow: update timestamp and increment counter
  UPDATE user_data
  SET next_profile_request_available_at = v_new_next,
      profile_request_count = profile_request_count + 1
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'next_fetch_available_at', v_new_next);
END;
$$;
