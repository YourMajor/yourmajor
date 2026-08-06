/**
 * The public marketing surface: the routes that carry the `.marketing` token
 * scope from globals.css. Chrome that is shared with the application (the nav
 * shell, the footer, the bottom tab bar) branches on this so it can adopt the
 * marketing world here and stay untouched everywhere else.
 *
 * Keep this in step with which roots actually apply the `marketing` class:
 * `(main)/page.tsx`, `(main)/pricing/page.tsx`, `(main)/features/page.tsx` and
 * `auth/_shared/AuthShell.tsx`.
 */
const MARKETING_ROUTES = new Set(['/', '/pricing', '/features'])

export function isMarketingRoute(pathname: string): boolean {
  return MARKETING_ROUTES.has(pathname) || pathname.startsWith('/auth/')
}
