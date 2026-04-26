// Reserved subdomains that conflict with app routes, infrastructure, or
// could be confusing/misleading. Keep this list lowercased.
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'dashboard', 'settings', 'billing', 'profile',
  'team', 'pricing', 'auth', 'login', 'logout', 'signup', 'register',
  'features', 'feedback', 'privacy', 'terms', 'tournaments', 'tournament',
  'help', 'support', 'docs', 'blog', 'about', 'contact', 'mail', 'email',
  'ftp', 'smtp', 'imap', 'pop', 'static', 'cdn', 'assets', 'img', 'images',
  'media', 'upload', 'uploads', 'download', 'downloads', 'public', 'private',
  'staging', 'dev', 'test', 'prod', 'production', 'demo', 'beta', 'alpha',
  'status', 'health', 'metrics', 'logs', 'analytics',
  'yourmajor', 'major', 'tour', 'club', 'pro', 'free',
])

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/

export type SubdomainValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; error: string }

export function validateSubdomain(input: string): SubdomainValidationResult {
  const normalized = input.trim().toLowerCase()

  if (!normalized) return { valid: false, error: 'Subdomain is required.' }
  if (normalized.length < 3) return { valid: false, error: 'Subdomain must be at least 3 characters.' }
  if (normalized.length > 63) return { valid: false, error: 'Subdomain must be 63 characters or less.' }

  if (!SUBDOMAIN_PATTERN.test(normalized)) {
    return {
      valid: false,
      error: 'Subdomain can only contain lowercase letters, numbers, and hyphens (cannot start or end with a hyphen).',
    }
  }

  if (normalized.includes('--')) {
    return { valid: false, error: 'Subdomain cannot contain consecutive hyphens.' }
  }

  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return { valid: false, error: 'That subdomain is reserved. Please choose another.' }
  }

  return { valid: true, normalized }
}

/**
 * Extract the subdomain portion from a host string, or null if the host has
 * no league-style subdomain. Excludes apex, www, and known platform subdomains.
 *
 * Examples:
 *   "myleague.yourmajor.app" → "myleague"
 *   "yourmajor.app"          → null
 *   "www.yourmajor.app"      → null
 *   "myleague.localhost:3000" → "myleague"
 */
export function extractLeagueSubdomain(host: string, rootDomain: string): string | null {
  const lowerHost = host.toLowerCase().split(':')[0] // drop port
  const lowerRoot = rootDomain.toLowerCase()

  if (!lowerHost.endsWith(`.${lowerRoot}`) && lowerHost !== lowerRoot) return null

  const subdomainPart = lowerHost === lowerRoot
    ? ''
    : lowerHost.slice(0, lowerHost.length - lowerRoot.length - 1)

  if (!subdomainPart) return null
  if (subdomainPart.includes('.')) return null // multi-level subdomains not supported
  if (RESERVED_SUBDOMAINS.has(subdomainPart)) return null

  return subdomainPart
}
