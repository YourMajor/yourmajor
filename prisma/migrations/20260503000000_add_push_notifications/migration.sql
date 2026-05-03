-- Web Push subscriptions for the PWA stopgap (one row per device).
-- Pruned automatically by sendPushToUser when the push service returns 410 Gone.
-- Two new boolean opt-ins on User control which triggers actually deliver.

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "notifyChatMessages" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "notifyAdminAnnouncements" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS to match project convention (Prisma's postgres role bypasses RLS,
-- so this denies the anon role by default without any permissive policies).
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
