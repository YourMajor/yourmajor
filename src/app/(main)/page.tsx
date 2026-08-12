import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { HeroSection } from '@/components/landing/HeroSection'
import { LeadChangeChapter } from '@/components/landing/LeadChangeChapter'
import { PosterInterstitial } from '@/components/landing/PosterInterstitial'
import {
  FeatureSplits,
  FeatureBento,
  FeatureList,
} from '@/components/features/FeaturesContent'
import { ShotTracerChapter } from '@/components/landing/ShotTracerChapter'
import { DraftChapter } from '@/components/landing/DraftChapter'
import { AdminChapter } from '@/components/landing/AdminChapter'
import { StatsBand } from '@/components/landing/StatsBand'
import { ScorecardRail } from '@/components/landing/ScorecardRail'
import { SmoothScroll } from '@/components/landing/SmoothScroll'
import { MobileCta } from '@/components/landing/MobileCta'
import { TournamentsSection } from '@/components/landing/TournamentsSection'

export default async function Home() {
  const user = await getUser()
  if (user) redirect('/dashboard')

  return (
    // overflow-x-clip, never -hidden: -hidden silently kills position:sticky
    // on descendants, and the hero's scroll sequence depends on it.
    <main id="content" className="marketing overflow-x-clip">
      {/* Mounted first: creates the ScrollSmoother (desktop full-motion)
          before any sibling chapter registers its ScrollTriggers. */}
      <SmoothScroll />

      <HeroSection />

      {/* The poster beat, then the leaderboard chapter. The volley of balls
          that used to fall into its own cup in a divider band now rains
          into the worm tube's cup instead — one hole, inside
          PosterInterstitial. */}
      <PosterInterstitial />

      {/* The clubhouse, early: real public events are the only proof on this
          page that isn't a mockup, and browsing one is the only action a
          visitor can take without an account. It used to sit past pricing,
          ~13,000px down on a phone. One heading, one list. */}
      <section
        id="clubhouse"
        className="mk-clubhouse-band mb-12 scroll-mt-24 lg:mb-20"
      >
        <div className="mk-container">
          {/* The name this section already carries everywhere else: the
              #clubhouse anchor, the rail's ninth tick, the footer link. Nav
              still says "Tournaments" — that label is for a stranger deciding
              whether to click; this is the room they arrive in. */}
          <h2>The clubhouse</h2>
          <p
            className="mt-4 max-w-[65ch] text-pretty text-base lg:text-lg"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            Public events taking entries, and whatever is running near you.
          </p>
          <div className="mt-10">
            <TournamentsSection />
          </div>
        </div>
      </section>

      <LeadChangeChapter />

      {/* The same sections /features renders, inlined here so the landing
          scroll tells the whole story. Signed-in visitors are redirected to
          /dashboard above and read them on /features instead.
          NOTE: no mk-section here — its unlayered padding-block beats any
          Tailwind pt-0, which is exactly the double gap we removed. */}
      <section id="features" className="scroll-mt-24" style={{ paddingBottom: 'var(--mk-section)' }}>
        {/* The dusk interlude: feature splits through the shot tracer sit on
            twilight slate, then the ground ramps back to green. */}
        <div className="mk-dusk-zone">
          <FeatureSplits />
          <ShotTracerChapter />
        </div>
        <DraftChapter />

        {/* Mobile-only mid-run CTA. The draft is the chapter that sells the
            product (social before competitive, PRODUCT.md), and on a phone
            the next CTA after it is thousands of pixels away. No price here:
            pricing lives on /pricing and nowhere else. */}
        <div className="mk-container mt-16 lg:hidden">
          <div
            className="flex flex-col items-start px-6 py-8"
            style={{
              border: '1px dashed var(--mk-rule-gold)',
              borderRadius: 'var(--mk-radius-lg)',
            }}
          >
            <p className="text-base leading-relaxed" style={{ color: 'var(--mk-text-muted)' }}>
              Set one up in five steps.
            </p>
            <Link href="/auth/signup" className="mk-btn mk-btn-primary mt-6">
              Create a tournament
            </Link>
          </div>
        </div>

        <FeatureBento />
        <AdminChapter />
        <StatsBand />
        <FeatureList />
      </section>

      {/* The page ends on the features run and hands straight to the footer's
          end plate, which is the closing set piece: night ground, the
          wordmark, the credits line. The nightfall zone that used to sit here
          carried a pricing summary, a season strip and the 18th; all three
          are gone, and a gradient wrapper with nothing in it is not a beat. */}

      {/* The page as a front nine: desktop-only chapter rail. */}
      <ScorecardRail />

      {/* Thumb-zone CTA once the hero scrolls away; mobile only. */}
      <MobileCta />
    </main>
  )
}
