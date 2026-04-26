import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  // Strip sslmode from connection string — pg-connection-string treats
  // sslmode=require as verify-full, which rejects the Supabase pooler cert.
  // We handle SSL explicitly via the ssl option below.
  const url = new URL(process.env.DATABASE_URL!)
  url.searchParams.delete('sslmode')
  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    // Dev with the Supabase Session pooler (port 5432) caps at ~15 connections
    // per project; without these, an exhausted pool surfaces as "Operation has
    // timed out" minutes later and crashes the static-paths dev worker.
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  })
  return new PrismaClient({ adapter })
}

// Force new client after prisma generate (cache-bust via generated client version)
const CLIENT_VERSION = '7.7.0-regen'
const cached = globalForPrisma.prisma
const versionKey = '__prismaClientVersion' as keyof typeof globalThis
const needsRefresh = (globalThis as unknown as Record<string, unknown>)[versionKey] !== CLIENT_VERSION

if (needsRefresh && cached) {
  // Disconnect stale client so a fresh one is created
  cached.$disconnect().catch(() => {})
  delete globalForPrisma.prisma
  ;(globalThis as unknown as Record<string, unknown>)[versionKey] = CLIENT_VERSION
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
