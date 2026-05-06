// Resolves the public base URL used in outbound emails, SMS, and any other
// links that leave the app. Order: explicit NEXT_PUBLIC_APP_URL → NEXTAUTH_URL
// (already configured in production) → hardcoded production domain.
// trim() guards against trailing whitespace/newlines that piped CLI tools
// can accidentally bake into env var values.
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://yourmajor.club'
  return url.trim()
}
