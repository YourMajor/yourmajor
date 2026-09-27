-- When each hole was first scored. submittedAt is bumped on every edit, which
-- let a correction reopen a finished card's 30-minute edit window.

-- AlterTable
ALTER TABLE "Score" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: the best record of first entry for existing rows.
UPDATE "Score" SET "createdAt" = "submittedAt";
