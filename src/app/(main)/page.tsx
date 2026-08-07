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
import { StatsBand } from '@/components/landing/StatsBand'
import { SeasonStrip } from '@/components/landing/SeasonStrip'
import { FormatsMarquee } from '@/components/landing/FormatsMarquee'
import { ScorecardRail } from '@/components/landing/ScorecardRail'
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
        <PosterInterstitial />
        <FeatureSplits />
        <ShotTracerChapter />
        <DraftChapter />
        <FeatureBento />
        <StatsBand />
        <FeatureList />
        <FormatsMarquee />
      </section>

      <PricingSummary />

      <div id="clubhouse" className="mk-container">
        <FeaturedTournaments />
        <NearbyTournamentsSection />
      </div>

      <SeasonStrip />

      {/* The page as a front nine: desktop-only chapter rail. */}
      <ScorecardRail />
    </main>
  )
}
