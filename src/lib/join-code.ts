import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion

// randomInt, not Math.random: the join code is a credential — it is the only
// thing standing between a stranger and a tournament's roster. Math.random is
// a seeded PRNG whose internal state can be recovered from a short run of
// outputs, so anyone who created a few tournaments and saw their own codes
// could predict others'. randomInt draws from the CSPRNG and is also free of
// the modulo bias a naive `% CHARS.length` would introduce.
function randomCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CHARS[randomInt(CHARS.length)]
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
