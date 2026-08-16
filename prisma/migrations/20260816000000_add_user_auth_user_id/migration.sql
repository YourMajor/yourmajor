-- Pin the Prisma User mirror to a Supabase auth identity instead of to an email.
--
-- getUser() resolved the mirror by id and, failing that, by email. That made
-- the email an identity: whoever held the address held the row. Email is now
-- allowed to change (behind a confirmation link), so it cannot be what a row
-- is looked up by, and the auth user id has to be stored somewhere the lookup
-- can key on.
--
-- Nullable, and deliberately not backfilled: rows created at signup use the
-- auth id as their primary key, but legacy and CSV-imported rows were created
-- with a random uuid that is not an auth id, and the two are indistinguishable
-- by shape. claimMirrorUser stamps each row the first time its owner
-- authenticates — by primary key for the modern rows, by a one-time email
-- match for the legacy ones.
--
-- Unique so a second row can never claim an identity that already has one; the
-- claim is written with `authUserId IS NULL` in its filter, so an existing
-- stamp is never overwritten.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON "User"("authUserId");
