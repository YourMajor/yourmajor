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
import { SeasonStrip } from '@/components/landing/SeasonStrip'
import { FormatsMarquee } from '@/components/landing/FormatsMarquee'
import { ScorecardRail } from '@/components/landing/ScorecardRail'
import { ClosingChapter } from '@/components/landing/ClosingChapter'
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
    <main id="content" className="marketing overflow-x-clip">
      <HeroSection />

      <LeadChangeChapter />

      {/* The same sections /features renders, inlined here so the landing
          scroll tells the whole story. Signed-in visitors are redirected to
          /dashboard above and read them on /features instead. */}
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

      {/* Nightfall: from here the evening comes down for good, ending in
          the footer's end plate. The last memory of a full scroll is the
          18th and the invitation, per peak-end. */}
      <div className="mk-night-zone">
        <div id="clubhouse" className="mk-container scroll-mt-24">
          <FeaturedTournaments />
          <NearbyTournamentsSection />
        </div>

        <SeasonStrip />

        <ClosingChapter />
      </div>

      {/* The page as a front nine: desktop-only chapter rail. */}
      <ScorecardRail />

      {/* Thumb-zone CTA once the hero scrolls away; mobile only. */}
      <MobileCta />
    </main>
  )
}
