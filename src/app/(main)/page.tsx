import { redirect } from 'next/navigation'
import Link from 'next/link'
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
import { SeasonStrip } from '@/components/landing/SeasonStrip'
import { FormatsMarquee } from '@/components/landing/FormatsMarquee'
import { ScorecardRail } from '@/components/landing/ScorecardRail'
import { MobileCta } from '@/components/landing/MobileCta'
import { PricingSummary } from '@/components/landing/PricingSummary'
import { FeaturedTournaments } from '@/components/landing/FeaturedTournaments'
import { NearbyTournamentsSection } from '@/components/landing/NearbyTournamentsSection'

export default async function Home() {
  const user = await getUser()
  if (user) redirect('/dashboard')

  return (
    // overflow-x-clip, never -hidden: -hidden silently kills position:sticky
    // on descendants, and the hero's scroll sequence depends on it.
    <main className="marketing overflow-x-clip">
      <HeroSection />

      <LeadChangeChapter />

      {/* Features live here now rather than on their own route; /features
          redirects to this anchor. */}
      <section id="features" className="mk-section scroll-mt-24 pt-0">
        {/* The dusk interlude: poster photo through the shot tracer sit on
            twilight slate, then the ground ramps back to green. */}
        <div className="mk-dusk-zone">
          <PosterInterstitial />
          <FeatureSplits />
          <FormatsMarquee />
          <ShotTracerChapter />
        </div>
        <DraftChapter />
        <FeatureBento />
        <AdminChapter />
        <StatsBand />
        <FeatureList />
      </section>

      <PricingSummary />

      <div id="clubhouse" className="mk-container scroll-mt-24">
        <FeaturedTournaments />
        <NearbyTournamentsSection />
      </div>

      <SeasonStrip />

      {/* The page ends on the action, not on an empty state: the last
          memory of a full scroll is the invitation, per peak-end. */}
      <section aria-label="Get started" className="mk-section pt-0 text-center">
        <div className="mk-container">
          <p
            className="mx-auto max-w-[40ch] text-lg"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            The first round is free. The rivalry is forever.
          </p>
          <Link href="/auth/signup" className="mk-btn mk-btn-primary mt-6">
            Create a tournament
          </Link>
        </div>
      </section>

      {/* The page as a front nine: desktop-only chapter rail. */}
      <ScorecardRail />

      {/* Thumb-zone CTA once the hero scrolls away; mobile only. */}
      <MobileCta />
    </main>
  )
}
