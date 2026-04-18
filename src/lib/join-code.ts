import { prisma } from '@/lib/prisma'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion

function randomCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}

/** Generate a unique 6-character join code for a tournament. */
export async function generateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode()
    const existing = await prisma.tournament.findUnique({ where: { joinCode: code } })
    if (!existing) return code
  }
  // Extremely unlikely — fall back to longer code
  return randomCode(8)
}
