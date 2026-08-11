import { NextResponse } from 'next/server'
import { z } from 'zod'

/** Brand colours are stored and rendered as #RRGGBB. */
export const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colors must be #RRGGBB')

/**
 * A date string safe to hand to `new Date()`. Plain `z.string()` is not enough:
 * `new Date('banana')` yields an Invalid Date, which Prisma will happily try to
 * write. Accepts both a full ISO timestamp and a bare YYYY-MM-DD, which is what
 * date inputs submit.
 */
export const ISO_DATE = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Must be a valid date')

/**
 * Parse and validate a JSON request body in one step.
 *
 * Two problems this fixes across the API routes:
 *
 *  1. `await request.json()` throws on a malformed body. Uncaught, that surfaces
 *     as a 500 — an input error reported as a server fault, which is both wrong
 *     and noisy in logs.
 *  2. Destructuring an unvalidated body hands whatever the caller sent straight
 *     to Prisma. Field-presence checks catch the missing case but not the wrong
 *     type, so a string where a number belongs reached the database.
 *
 * Returns a discriminated union rather than throwing, so callers keep their
 * existing early-return style:
 *
 *     const parsed = await parseBody(request, schema)
 *     if (!parsed.ok) return parsed.response
 *     const { foo } = parsed.data
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    // First issue only — these are developer/client errors, and the full issue
    // list is noise in a UI toast. Path is included so the field is obvious.
    const issue = result.error.issues[0]
    const path = issue?.path.join('.')
    const message = issue
      ? `${path ? `${path}: ` : ''}${issue.message}`
      : 'Validation failed'
    return { ok: false, response: NextResponse.json({ error: message }, { status: 400 }) }
  }

  return { ok: true, data: result.data }
}
