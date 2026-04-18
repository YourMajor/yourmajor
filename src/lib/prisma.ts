import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

// Force new client after prisma generate (cache-bust via generated client version)
const CLIENT_VERSION = '7.7.0-regen'
const cached = globalForPrisma.prisma
const versionKey = '__prismaClientVersion' as keyof typeof globalThis
const needsRefresh = (globalThis as any)[versionKey] !== CLIENT_VERSION

if (needsRefresh && cached) {
  // Disconnect stale client so a fresh one is created
  cached.$disconnect().catch(() => {})
  delete globalForPrisma.prisma
  ;(globalThis as any)[versionKey] = CLIENT_VERSION
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
