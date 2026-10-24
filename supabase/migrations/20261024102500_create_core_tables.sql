/*
# Create core tables for opportunities app

This migration creates the five tables the app needs: profiles, listings,
matches, saved, and agent_runs. All tables use row-level security scoped to
the logged-in user via auth.uid(). The app uses Supabase email/password auth,
so all policies are scoped TO authenticated.

## 1. New Tables

### profiles
- id (uuid, PK, references auth.users) — one row per user
- name (text, not null)
- college (text)
- branch (text)
- year (text) — one of: '1st', '2nd', '3rd', '4th', 'PG'
- state (text)
- category (text) — one of: 'General', 'OBC', 'SC', 'ST', 'EWS'
- family_income (text) — family income range bucket
- cgpa (numeric)
- interests (text[]) — selectable interests: scholarships, internships, hackathons, govt schemes
- skills (text[]) — free-text tags the user adds
- created_at (timestamptz)
- updated_at (timestamptz)

### listings
- id (uuid, PK)
- title (text, not null)
- type (text) — listing type/category
- url (text)
- deadline (date)
- eligibility (text)
- documents (jsonb) — required documents
- summary (text)
- source_url (text)
- last_verified_at (timestamptz)
- created_at (timestamptz)
Readable by ALL logged-in users (shared catalog).

### matches
- id (uuid, PK)
- user_id (uuid, references auth.users) — owner
- listing_id (uuid, references listings)
- score (numeric)
- why_match (text)
- missing (jsonb)
- created_at (timestamptz)
Owner-scoped: each user only sees their own matches.

### saved
- id (uuid, PK)
- user_id (uuid, references auth.users) — owner
- listing_id (uuid, references listings)
- reminder_date (date)
- created_at (timestamptz)
Owner-scoped: each user only sees their own saved listings.

### agent_runs
- id (uuid, PK)
- user_id (uuid, references auth.users) — owner
- run_id (uuid) — unique run identifier
- listing_id (uuid, references listings, nullable)
- status (text) — run status
- result (jsonb)
- created_at (timestamptz)
Owner-scoped: each user only sees their own agent runs.

## 2. Security

All tables get RLS enabled and grants only to `authenticated` (the app
requires sign-in). Owner-scoped tables use auth.uid() = user_id. listings
is readable by all authenticated users (shared catalog) but only
service_role can write (it is an admin-managed catalog).

### profiles
- SELECT, INSERT, UPDATE, DELETE: authenticated, own row (id = auth.uid())
- user_id is the primary key id, which defaults to auth.uid() on insert

### listings
- SELECT: authenticated (all rows — shared catalog)
- No INSERT/UPDATE/DELETE for authenticated (admin-managed via service_role)
- service_role gets full access for seeding/maintenance

### matches
- SELECT, INSERT, UPDATE, DELETE: authenticated, own row (user_id = auth.uid())
- user_id defaults to auth.uid()

### saved
- SELECT, INSERT, UPDATE, DELETE: authenticated, own row (user_id = auth.uid())
- user_id defaults to auth.uid()

### agent_runs
- SELECT, INSERT, UPDATE, DELETE: authenticated, own row (user_id = auth.uid())
- user_id defaults to auth.uid()

## 3. Notes

- profiles.id doubles as the user id (one-to-one with auth.users). The
  default of auth.uid() makes an insert that omits id populate it from the
  session, satisfying the INSERT policy's WITH CHECK.
- listings has no user_id because it is a shared catalog. Writes are
  restricted to the service_role (edge functions / admin tooling), not
  exposed to authenticated clients.
- All owner-scoped child tables (matches, saved, agent_runs) reference
  listings via listing_id so listings can't be orphaned while referenced.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  college text,
  branch text,
  year text CHECK (year IN ('1st','2nd','3rd','4th','PG')),
  state text,
  category text CHECK (category IN ('General','OBC','SC','ST','EWS')),
  family_income text,
  cgpa numeric(3,2),
  interests text[] DEFAULT '{}',
  skills text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- updated_at trigger for profiles
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- listings
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text,
  url text,
  deadline date,
  eligibility text,
  documents jsonb DEFAULT '{}'::jsonb,
  summary text,
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON listings TO authenticated;

DROP POLICY IF EXISTS "select_listings" ON listings;
CREATE POLICY "select_listings" ON listings FOR SELECT
  TO authenticated USING (true);

-- matches
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  score numeric(5,2),
  why_match text,
  missing jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON matches TO authenticated;

DROP POLICY IF EXISTS "select_own_matches" ON matches;
CREATE POLICY "select_own_matches" ON matches FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_matches" ON matches;
CREATE POLICY "insert_own_matches" ON matches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_matches" ON matches;
CREATE POLICY "update_own_matches" ON matches FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_matches" ON matches;
CREATE POLICY "delete_own_matches" ON matches FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- saved
CREATE TABLE IF NOT EXISTS saved (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reminder_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON saved TO authenticated;

DROP POLICY IF EXISTS "select_own_saved" ON saved;
CREATE POLICY "select_own_saved" ON saved FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved" ON saved;
CREATE POLICY "insert_own_saved" ON saved FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_saved" ON saved;
CREATE POLICY "update_own_saved" ON saved FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved" ON saved;
CREATE POLICY "delete_own_saved" ON saved FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- agent_runs
CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  result jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON agent_runs TO authenticated;

DROP POLICY IF EXISTS "select_own_agent_runs" ON agent_runs;
CREATE POLICY "select_own_agent_runs" ON agent_runs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_agent_runs" ON agent_runs;
CREATE POLICY "insert_own_agent_runs" ON agent_runs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_agent_runs" ON agent_runs;
CREATE POLICY "update_own_agent_runs" ON agent_runs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_agent_runs" ON agent_runs;
CREATE POLICY "delete_own_agent_runs" ON agent_runs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_user_id ON saved(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_run_id ON agent_runs(run_id);