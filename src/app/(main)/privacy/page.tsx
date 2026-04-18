import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | YourMajor',
  description: 'Privacy Policy for the YourMajor golf tournament platform.',
}

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-heading font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: April 15, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">1. Introduction</h2>
          <p className="mt-3">
            YourMajor (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to
            protecting your privacy. This Privacy Policy explains what information we
            collect, how we use it, and the choices you have regarding your data. By using
            YourMajor, you agree to the collection and use of information in accordance with
            this policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">2. Information We Collect</h2>
          <p className="mt-3">We collect the following types of information:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Email address</strong> &mdash; used for authentication and communication</li>
            <li><strong>Display name</strong> &mdash; shown on leaderboards and within tournaments</li>
            <li><strong>Handicap index</strong> &mdash; used for scoring calculations</li>
            <li><strong>Tournament scores</strong> &mdash; hole-by-hole scores entered during play</li>
            <li><strong>Photos</strong> &mdash; images uploaded to tournament galleries</li>
            <li><strong>Approximate location</strong> &mdash; used for the nearby tournaments feature, when permitted by your device</li>
            <li><strong>Device information</strong> &mdash; browser type, operating system, and general device characteristics for platform compatibility</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">3. How We Use Information</h2>
          <p className="mt-3">We use the information we collect to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Create and manage your account</li>
            <li>Operate tournaments, including scoring, leaderboards, and drafts</li>
            <li>Communicate with you about tournament updates and account activity via our email service provider (Resend)</li>
            <li>Improve the platform and develop new features</li>
            <li>Maintain the security and integrity of the service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">4. Information Sharing</h2>
          <p className="mt-3">
            We do not sell your personal data to third parties. Your information may be
            shared in the following limited circumstances:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Tournament administrators</strong> &mdash; organizers can see participant data (name, scores, handicap) for tournaments they manage</li>
            <li><strong>Fellow participants</strong> &mdash; other players in a tournament can see your display name, scores, and photos within that tournament</li>
            <li><strong>Service providers</strong> &mdash; we use Supabase for authentication and database services, and Resend for transactional email delivery. These providers process data on our behalf under strict contractual obligations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">5. Data Retention</h2>
          <p className="mt-3">
            We retain your personal data for as long as your account is active or as needed
            to provide services. You may request deletion of your account and associated
            data at any time by contacting us. Upon receiving a deletion request, we will
            remove your personal data within 30 days, except where retention is required by
            law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">6. Your Rights (CCPA)</h2>
          <p className="mt-3">
            If you are a California resident, the California Consumer Privacy Act (CCPA)
            provides you with the following rights:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Right to know</strong> &mdash; you can request details about the personal information we have collected about you</li>
            <li><strong>Right to delete</strong> &mdash; you can request that we delete your personal information</li>
            <li><strong>Right to opt-out of sale</strong> &mdash; we do not sell personal information, so this right is automatically satisfied</li>
            <li><strong>Right to non-discrimination</strong> &mdash; we will not discriminate against you for exercising your privacy rights</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{' '}
            <a href="mailto:hartleyfanson@gmail.com" className="underline hover:text-foreground">
              hartleyfanson@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">7. Your Rights (GDPR)</h2>
          <p className="mt-3">
            If you are located in the European Union, you have the following rights under
            the General Data Protection Regulation (GDPR):
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Access</strong> &mdash; request a copy of the personal data we hold about you</li>
            <li><strong>Rectification</strong> &mdash; request correction of inaccurate data</li>
            <li><strong>Erasure</strong> &mdash; request deletion of your personal data</li>
            <li><strong>Portability</strong> &mdash; request your data in a structured, machine-readable format</li>
            <li><strong>Right to object</strong> &mdash; object to processing of your data for certain purposes</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{' '}
            <a href="mailto:hartleyfanson@gmail.com" className="underline hover:text-foreground">
              hartleyfanson@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">8. Cookies &amp; Tracking</h2>
          <p className="mt-3">
            YourMajor uses Supabase session cookies for authentication purposes only. These
            cookies are essential for keeping you signed in and ensuring the security of
            your session. We do not use third-party tracking cookies, advertising cookies,
            or analytics that track you across other websites.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">9. Children&apos;s Privacy</h2>
          <p className="mt-3">
            YourMajor is not directed at children under the age of 13. We do not knowingly
            collect personal information from children under 13. If we become aware that we
            have collected data from a child under 13, we will take steps to delete that
            information promptly. If you believe a child under 13 has provided us with
            personal data, please contact us at{' '}
            <a href="mailto:hartleyfanson@gmail.com" className="underline hover:text-foreground">
              hartleyfanson@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">10. Security</h2>
          <p className="mt-3">
            We take the security of your data seriously. YourMajor employs the following
            measures to protect your information:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>SSL/TLS encryption for all data in transit</li>
            <li>Supabase authentication with magic link email verification</li>
            <li>Encrypted database connections</li>
            <li>Regular review of security practices</li>
          </ul>
          <p className="mt-2">
            While we strive to protect your data, no method of electronic transmission or
            storage is completely secure. We cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">11. Changes to Privacy Policy</h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. When we make changes, we
            will revise the &quot;Last updated&quot; date at the top of this page and notify
            users of material changes via email or a prominent notice on the platform. Your
            continued use of YourMajor after changes are posted constitutes acceptance of
            the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">12. Contact</h2>
          <p className="mt-3">
            If you have questions about this Privacy Policy or how your data is handled,
            please contact us at{' '}
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
