import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseBody, HEX_COLOR, ISO_DATE } from '@/lib/parse-body'

function req(body: string) {
  return new Request('http://localhost/api/test', { method: 'POST', body })
}

const schema = z.object({
  name: z.string().min(1),
  count: z.number().int(),
})

describe('parseBody', () => {
  it('returns typed data for a valid body', async () => {
    const result = await parseBody(req('{"name":"Ryder","count":4}'), schema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ name: 'Ryder', count: 4 })
  })

  // Previously this threw out of the route and surfaced as a 500 — an input
  // error reported as a server fault.
  it('answers malformed JSON with 400, not a throw', async () => {
    const result = await parseBody(req('{not json'), schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
      expect(await result.response.json()).toEqual({ error: 'Invalid JSON body' })
    }
  })

  it('rejects a wrong field type', async () => {
    const result = await parseBody(req('{"name":"Ryder","count":"four"}'), schema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it('names the offending field in the message', async () => {
    const result = await parseBody(req('{"name":"","count":1}'), schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const { error } = await result.response.json()
      expect(error).toContain('name')
    }
  })

  it('rejects a body that is not an object at all', async () => {
    const result = await parseBody(req('"just a string"'), schema)
    expect(result.ok).toBe(false)
  })
})

describe('shared field schemas', () => {
  it('HEX_COLOR accepts #RRGGBB only', () => {
    expect(HEX_COLOR.safeParse('#006747').success).toBe(true)
    expect(HEX_COLOR.safeParse('#C9A84C').success).toBe(true)
    expect(HEX_COLOR.safeParse('006747').success).toBe(false)
    expect(HEX_COLOR.safeParse('#fff').success).toBe(false)
    expect(HEX_COLOR.safeParse('red').success).toBe(false)
  })

  // new Date('banana') is an Invalid Date rather than a throw, and Prisma will
  // try to write it — so the guard has to be an explicit validity check.
  it('ISO_DATE rejects strings new Date() cannot parse', () => {
    expect(ISO_DATE.safeParse('2026-08-10').success).toBe(true)
    expect(ISO_DATE.safeParse('2026-08-10T09:30:00.000Z').success).toBe(true)
    expect(ISO_DATE.safeParse('banana').success).toBe(false)
    expect(ISO_DATE.safeParse('').success).toBe(false)
  })
})
