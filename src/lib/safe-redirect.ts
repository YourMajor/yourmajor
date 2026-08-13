/**
 * Constrain a caller-supplied `next` / `redirectTo` value to a same-origin path.
 *
 * Anything that isn't a single-slash-prefixed path becomes the fallback. The
 * cases that matter, and why the naive `startsWith('/')` check isn't enough:
 *
 *   - `//evil.com`  — protocol-relative URL, browsers treat it as absolute
 *   - `/\evil.com`  — backslash variant; WHATWG URL parsing folds `\` to `/`
 *   - `@evil.com`   — no leading slash, so `${origin}${next}` yields
 *                     `https://yourmajor.club@evil.com`, where the real host is
 *                     evil.com and our domain is just the userinfo component
 *   - `https://…`   — absolute URL passed straight to redirect()
 *   - `/<TAB>/evil.com` — the WHATWG URL parser strips ASCII tab, LF and CR
 *                     anywhere in the string before parsing, so this resolves
 *                     to `//evil.com`; checking the raw string would approve a
 *                     value the browser never sees
 */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback
  // Reject before the checks below, so the string they approve is the string
  // the browser resolves. Rejecting rather than stripping keeps that identical.
  if (/[\t\n\r]/.test(next)) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
