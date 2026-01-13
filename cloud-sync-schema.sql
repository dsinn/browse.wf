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
  discord_user_id VARCHAR(20) PRIMARY KEY,  -- Discord's user.id (snowflake)
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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

-- Users can only access their own Discord ID
CREATE POLICY "Users can view own data"
  ON user_data FOR SELECT
  USING (discord_user_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id'));

CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (discord_user_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id'));

CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (discord_user_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id'));

-- Optional: DELETE policy (no UI implemented, but allows manual deletion if needed)
CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (discord_user_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id'));

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
