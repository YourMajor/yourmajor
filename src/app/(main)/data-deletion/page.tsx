import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | YourMajor',
  description:
    'How to request deletion of your YourMajor account and personal data, including data shared via third-party sign-in providers.',
}

export default function DataDeletionPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-heading font-bold">Data Deletion Instructions</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: May 7, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">1. Your right to deletion</h2>
          <p className="mt-3">
            You can request deletion of your YourMajor account and any personal data we hold
            about you at any time. This applies to data you provided directly (name, email,
            handicap, scores, photos) as well as data we received from third-party sign-in
            providers such as Google or Apple.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">2. How to request deletion</h2>
          <p className="mt-3">
            To request deletion, send an email to{' '}
            <a
              href="mailto:hartleyfanson@gmail.com?subject=Data%20deletion%20request"
              className="underline hover:text-foreground"
            >
              hartleyfanson@gmail.com
            </a>{' '}
            from the email address associated with your YourMajor account, with the subject
            line <strong>&quot;Data deletion request&quot;</strong>.
          </p>
          <p className="mt-3">In the body, please include:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>The email address on your YourMajor account</li>
            <li>
              The sign-in provider you used (email/password, Google, Apple, or magic link)
            </li>
            <li>
              Optionally, the display name you used in tournaments — useful if your account
              email differs from your tournament identity
            </li>
          </ul>
          <p className="mt-3">
            We&apos;ll confirm receipt within 2 business days and complete the deletion within
            30 days, in line with our{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">3. What gets deleted</h2>
          <p className="mt-3">When we process your deletion request, we remove:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Your account record (email, display name, profile image)</li>
            <li>Your player profile, including handicap and avatar</li>
            <li>Your tournament participation records, including scores and team memberships</li>
            <li>Photos you uploaded to tournament galleries</li>
            <li>Chat messages you posted in tournament chats</li>
            <li>Notifications and email preferences linked to your account</li>
            <li>Identity links to third-party sign-in providers (Google, Apple)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">4. What may be retained</h2>
          <p className="mt-3">In a small number of cases we may retain limited information:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              Tournament leaderboards owned by other organizers may continue to show
              anonymized historical results (e.g., a placeholder name) so that the
              tournament&apos;s record remains intact for the other participants
            </li>
            <li>
              Aggregated, non-identifying analytics that cannot be traced back to you
            </li>
            <li>
              Records we are legally required to keep (for example, financial records
              related to paid tournaments, where applicable)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">
            5. Disconnecting third-party sign-in
          </h2>
          <p className="mt-3">
            If you only want to disconnect a third-party login (Google or Apple) without
            deleting your YourMajor account, you can do so by revoking access from the
            provider directly:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Google:</strong>{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                myaccount.google.com/permissions
              </a>
            </li>
            <li>
              <strong>Apple:</strong> Settings → Apple ID → Sign in with Apple → YourMajor →
              Stop using Apple ID
            </li>
          </ul>
          <p className="mt-3">
            Disconnecting a provider stops it from being usable for sign-in but does not
            delete your YourMajor account or data. To delete your data, follow the steps in
            section 2.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">6. Questions</h2>
          <p className="mt-3">
            If you have questions about this process or about the data we hold, contact us at{' '}
            <a
              href="mailto:hartleyfanson@gmail.com"
              className="underline hover:text-foreground"
            >
              hartleyfanson@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  )
}
