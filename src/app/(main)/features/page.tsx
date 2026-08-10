import {
  FeatureSplits,
  FeatureBento,
  FeatureList,
} from '@/components/features/FeaturesContent'

export const metadata = {
  title: 'Features - YourMajor',
  description:
    'Custom branding, live leaderboards, powerup drafts and season standings — everything YourMajor does for players, groups, leagues and courses.',
}

/**
 * The feature surface on its own route.
 *
 * This route used to be `redirect('/#features')`, on the assumption that the
 * landing page could serve both audiences. It can't: the landing page sends
 * signed-in visitors to /dashboard, so for them the redirect chain was
 * /features → /#features → /dashboard — a click that silently returned you to
 * where you started. That is what the dashboard's "See all features" card,
 * the nav and the mobile tab bar all hit while logged in.
 *
 * Rendering the sections here instead works for both audiences. They also
 * appear inline on the landing page, which is what signed-out visitors see.
 */
export default function FeaturesPage() {
  return (
    <main id="content" className="marketing overflow-x-clip">
      <section className="mk-section relative pt-32">
        <div className="mk-container relative z-10 max-w-3xl text-center lg:max-w-4xl">
          <h1>Everything your tournament needs</h1>
          <p
            className="mx-auto mt-4 max-w-xl text-base lg:max-w-2xl lg:text-lg"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            Run it like a major. Live scoring, a powerup draft, season standings
            and your own branding — for players, groups, leagues and courses.
          </p>
        </div>
      </section>

      <FeatureSplits />
      <FeatureBento />
      <FeatureList />
    </main>
  )
}
