-- Fixed-window counters for abuse-prevention rate limits.
-- Postgres-backed rather than in-memory: the app runs on serverless instances,
-- so a per-instance counter would let an attacker spread requests across
-- lambdas and bypass the limit entirely.

-- CreateTable
CREATE TABLE IF NOT EXISTS "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
