import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { SUPABASE_ROOT_CA_2021 } from './supabase-ca'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const versionKey = '__prismaClientVersion' as keyof typeof globalThis
// Force new client after prisma generate (cache-bust via generated client version)
const CLIENT_VERSION = '7.7.0-regen'

function createPrismaClient(): PrismaClient {
  // Strip sslmode from connection string — pg-connection-string treats
  // sslmode=require as verify-full against the *system* trust store, which
  // rejects the Supabase pooler cert. The pooler's chain roots in Supabase's
  // own "Supabase Root 2021 CA", so we supply that CA explicitly below and
  // get real verification rather than turning verification off.
  const url = new URL(process.env.DATABASE_URL!)
  url.searchParams.delete('sslmode')

  // Escape hatch for a CA rotation that outpaces a deploy: setting
  // DB_SSL_INSECURE=1 restores the old unverified behaviour, so a expired-CA
  // outage is an env-var flip rather than a code change. Not for normal use.
  const insecure = process.env.DB_SSL_INSECURE === '1'
  if (insecure) {
    console.warn('[prisma] DB_SSL_INSECURE=1 — database TLS certificate verification is DISABLED')
  }

  const adapter = new PrismaPg({
    connectionString: url.toString(),
    ssl: insecure
      ? { rejectUnauthorized: false }
      : { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true },
    // Dev with the Supabase Session pooler (port 5432) caps at ~15 connections
    // per project; without these, an exhausted pool surfaces as "Operation has
    // timed out" minutes later and crashes the static-paths dev worker.
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  })
  return new PrismaClient({ adapter })
}

function getClient(): PrismaClient {
  const stored = (globalThis as unknown as Record<string, unknown>)[versionKey]
  if (stored !== CLIENT_VERSION && globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {})
    delete globalForPrisma.prisma
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
    if (process.env.NODE_ENV === 'production') {
      // In dev hot-reload uses the global cache; in prod the lambda lifetime
      // is the cache. Either way, only set the version key once we've
      // successfully created a client.
      ;(globalThis as unknown as Record<string, unknown>)[versionKey] = CLIENT_VERSION
    } else {
      ;(globalThis as unknown as Record<string, unknown>)[versionKey] = CLIENT_VERSION
    }
  }
  return globalForPrisma.prisma
}

// Lazy proxy — defer createPrismaClient() until first property access.
// Prevents `new URL(process.env.DATABASE_URL)` from throwing at module load
// on environments without DATABASE_URL (Vercel Preview, page-data collection
// during build, etc.). Real client is only constructed when a query runs.
// Methods are bound to the real client so $transaction / $disconnect / etc.
// have the correct `this`.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient()
    const value = client[prop as keyof PrismaClient]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
}) as PrismaClient
