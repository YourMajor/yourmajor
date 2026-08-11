/**
 * App-wide Content-Security-Policy.
 *
 * Nonce-based rather than script-src 'unsafe-inline'. Next emits an inline
 * bootstrap script on every page and stamps it with the nonce it finds in the
 * request's CSP header, so a nonce is the only way to get a script-src worth
 * having. The usual objection — nonces force dynamic rendering — costs nothing
 * here: the root layout already awaits cookies() to paint the theme, so every
 * page in this app is dynamic already.
 */

// Supabase serves REST, auth, storage and the realtime socket from one project
// host, and dev and prod are two separate projects — so derive it rather than
// hardcode. See the two-supabase-projects note.
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function buildCsp(
  nonce: string,
  isDev: boolean = process.env.NODE_ENV === 'development',
): string {
  const supabase = supabaseOrigin()

  const directives: Record<string, (string | false | null)[]> = {
    'default-src': ["'self'"],

    // 'strict-dynamic' lets a nonced script load further scripts — that is how
    // Next pulls its chunks in — and makes the browser ignore host allowlists
    // in script-src entirely, which is the point: no third-party origin can be
    // talked into serving one. 'unsafe-eval' is dev-only; React uses eval there
    // to rebuild server-side error stacks in the browser.
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", isDev && "'unsafe-eval'"],

    // Deliberately no nonce on style-src: a nonce makes browsers ignore
    // 'unsafe-inline', and React renders every style={{...}} prop as an inline
    // style attribute. CSS injection is the far smaller risk than a blank app.
    'style-src': ["'self'", "'unsafe-inline'"],

    'img-src': [
      "'self'",
      'data:',
      'blob:', // react-easy-crop previews before upload
      supabase, // <Image unoptimized> hits Storage directly, bypassing /_next/image
      'https://api.mapbox.com', // static satellite tile in HoleOverview
      'https://lh3.googleusercontent.com', // Google account avatars
      'https://avatars.githubusercontent.com',
      'https://images.unsplash.com',
    ],

    // next/font/google self-hosts at build time, so no fonts.gstatic.com here.
    'font-src': ["'self'", 'data:'],

    'connect-src': [
      "'self'",
      supabase,
      supabase && supabase.replace(/^https:/, 'wss:'), // realtime socket
      isDev && 'ws://localhost:*', // Next dev HMR
    ],

    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    // Matches the X-Frame-Options: SAMEORIGIN already set in next.config.ts,
    // which stays as the CSP-2 fallback.
    'frame-ancestors': ["'self'"],
  }

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.filter(Boolean).join(' ')}`)
    .join('; ')

  // Pointless on http://localhost and it breaks nothing there, but skip it in
  // dev anyway so the header reads the same as what the browser acts on.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`
}
