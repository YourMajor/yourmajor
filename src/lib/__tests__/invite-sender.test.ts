import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { invitationToken } from '@/lib/invite-sender'

describe('invitationToken', () => {
  it('is long enough to be unguessable', () => {
    // 32 random bytes as base64url = 43 chars / 256 bits. cuid, the old schema
    // default, carried ~41 bits of real randomness in 25 chars.
    const token = invitationToken()
    expect(token).toHaveLength(43)
  })

  it('is URL-safe — it is handed out as ?token=', () => {
    for (let i = 0; i < 100; i++) {
      expect(invitationToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('does not repeat', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => invitationToken()))
    expect(tokens.size).toBe(1000)
  })

  it('does not look like a cuid', () => {
    // A cuid is 'c' + 24 lowercase base36 chars, and consecutive ones share a
    // timestamp prefix — the property that made the old default guessable.
    const [a, b] = [invitationToken(), invitationToken()]
    expect(a).not.toMatch(/^c[a-z0-9]{24}$/)
    expect(a.slice(0, 8)).not.toBe(b.slice(0, 8))
  })
})

describe('Invitation.token schema default', () => {
  it('has no @default — every create site must pass invitationToken()', () => {
    // Guards the root cause: with a default in place, a new create site that
    // forgets `token` compiles fine and silently gets a Math.random cuid.
    const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const model = schema.match(/model Invitation \{[\s\S]*?\n\}/)?.[0]
    expect(model).toBeDefined()
    const tokenField = model!.split('\n').find((l) => /^\s*token\s+String/.test(l))
    expect(tokenField).toBeDefined()
    expect(tokenField).not.toContain('@default')
  })
})
