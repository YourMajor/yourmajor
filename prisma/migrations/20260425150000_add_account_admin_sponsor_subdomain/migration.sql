-- Tournament: sponsor placement fields (Club & Tour) and custom subdomain (Tour only).
-- IF NOT EXISTS guards make this safe even if the schema was partially applied
-- via the now-deprecated manual-SQL workflow.

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "sponsorLink" TEXT,
  ADD COLUMN IF NOT EXISTS "sponsorLogoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sponsorName" TEXT,
  ADD COLUMN IF NOT EXISTS "subdomain" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Tournament_subdomain_key" ON "Tournament"("subdomain");

-- AccountAdmin: 2-seat (Club) / 5-seat (Tour) co-admin model.
-- Co-admins inherit admin rights on every tournament owned by `owner`.

CREATE TABLE IF NOT EXISTS "AccountAdmin" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "invitedEmail" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountAdmin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountAdmin_ownerUserId_idx" ON "AccountAdmin"("ownerUserId");
CREATE INDEX IF NOT EXISTS "AccountAdmin_adminUserId_idx" ON "AccountAdmin"("adminUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "AccountAdmin_ownerUserId_adminUserId_key"
  ON "AccountAdmin"("ownerUserId", "adminUserId");

-- Postgres has no `ADD CONSTRAINT IF NOT EXISTS`, so wrap each FK add in a
-- catalog lookup. Idempotent with the partial-apply scenario above.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountAdmin_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "AccountAdmin"
      ADD CONSTRAINT "AccountAdmin_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountAdmin_adminUserId_fkey'
  ) THEN
    ALTER TABLE "AccountAdmin"
      ADD CONSTRAINT "AccountAdmin_adminUserId_fkey"
      FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Enable RLS on the new table to match the project pattern from
-- 20260423100000_enable_rls_all_tables. Prisma uses the postgres role which
-- bypasses RLS, so app behaviour is unchanged; this prevents the Supabase
-- `anon` PostgREST role from enumerating co-admin assignments.

ALTER TABLE "AccountAdmin" ENABLE ROW LEVEL SECURITY;
