import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use | YourMajor',
  description: 'Terms of Use for the YourMajor golf tournament platform.',
}

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-heading font-bold">Terms of Use</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: April 15, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">1. Acceptance of Terms</h2>
          <p className="mt-3">
            By accessing or using YourMajor, you agree to be bound by these Terms of Use.
            If you do not agree to these terms, please do not use our platform. Your
            continued use of YourMajor after any changes to these terms constitutes
            acceptance of those changes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">2. Description of Service</h2>
          <p className="mt-3">
            YourMajor is a golf tournament management platform that provides live scoring,
            leaderboards, powerup drafts, photo galleries, and chat features. The platform
            enables tournament organizers to create and manage events, and participants to
            engage with tournament activities in real time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">3. Account Registration &amp; Security</h2>
          <p className="mt-3">
            YourMajor uses magic link email authentication to verify your identity. You are
            responsible for maintaining the security of the email account associated with
            your YourMajor account. You agree to notify us immediately of any unauthorized
            use of your account. YourMajor is not liable for any loss arising from
            unauthorized access to your email.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">4. User Content</h2>
          <p className="mt-3">
            You may submit content to the platform including scores, photos, and messages.
            You retain ownership of all content you submit. By posting content on YourMajor,
            you grant us a non-exclusive, royalty-free license to display, distribute, and
            use that content within the platform for the purpose of operating the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">5. Acceptable Use</h2>
          <p className="mt-3">You agree not to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Submit false or manipulated scores</li>
            <li>Cheat or exploit the scoring system in any way</li>
            <li>Harass, threaten, or intimidate other users</li>
            <li>Send spam or unsolicited messages through the platform</li>
            <li>Upload content that infringes on the intellectual property rights of others</li>
            <li>Attempt to gain unauthorized access to other accounts or platform systems</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">6. Intellectual Property</h2>
          <p className="mt-3">
            The YourMajor name, logo, branding, and platform design are proprietary and
            protected by applicable intellectual property laws. You may not reproduce,
            modify, or distribute any part of the YourMajor platform without prior written
            permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">7. Disclaimer of Warranties</h2>
          <p className="mt-3">
            Tournament scores displayed on YourMajor are entered by users and are not
            independently verified by the platform. YourMajor makes no guarantees regarding
            the accuracy of scores or handicap calculations. The service is provided
            &quot;as-is&quot; and &quot;as available&quot; without warranties of any kind,
            either express or implied, including but not limited to implied warranties of
            merchantability or fitness for a particular purpose.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">8. Limitation of Liability</h2>
          <p className="mt-3">
            To the fullest extent permitted by law, YourMajor and its operators shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages
            arising out of or related to your use of the platform. Our total liability for
            any claim arising from these terms or use of the service shall not exceed the
            amount you paid to YourMajor, if any, during the twelve months preceding the
            claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">9. Termination</h2>
          <p className="mt-3">
            YourMajor reserves the right to suspend or terminate your account at any time if
            you violate these Terms of Use. Upon termination, your right to use the platform
            will cease immediately. Provisions that by their nature should survive
            termination will remain in effect.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">10. Governing Law</h2>
          <p className="mt-3">
            These Terms of Use shall be governed by and construed in accordance with the
            laws of the United States. Any disputes arising from these terms or your use of
            YourMajor shall be resolved in accordance with applicable federal and state law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">11. Changes to Terms</h2>
          <p className="mt-3">
            We may update these Terms of Use from time to time. When we make material
            changes, we will notify users via email or a prominent notice on the platform.
            The &quot;Last updated&quot; date at the top of this page reflects when the
            terms were most recently revised.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-heading font-semibold mt-0">12. Contact</h2>
          <p className="mt-3">
            If you have questions about these Terms of Use, please contact us at{' '}
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
