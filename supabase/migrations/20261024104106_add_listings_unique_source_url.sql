/*
# Add unique constraint on listings.source_url and grant service_role

The extract-listing edge function upserts extracted listings keyed on
source_url (for the 24-hour cache). That requires a unique constraint on
source_url so ON CONFLICT (source_url) works. The service_role also needs
INSERT and UPDATE grants on listings to write rows.

## 1. Schema changes
- listings: add unique constraint on source_url (NULLS DISTINCT so multiple
  null source_urls are allowed, though in practice source_url is always set
  by the edge function).

## 2. Security changes
- GRANT INSERT, UPDATE ON listings TO service_role (the edge function uses
  the service role key to write). RLS still applies, but service_role
  bypasses RLS; authenticated users retain SELECT-only as before.
*/

-- Unique constraint on source_url for upsert ON CONFLICT.
-- Use NULLS NOT DISTINCT so two rows with NULL source_url would conflict too,
-- but since source_url is always set by the edge function this is fine.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_source_url_key'
  ) THEN
    ALTER TABLE listings ADD CONSTRAINT listings_source_url_key UNIQUE (source_url);
  END IF;
END $$;

-- Grant INSERT and UPDATE to service_role for edge-function upserts.
GRANT INSERT, UPDATE ON listings TO service_role;