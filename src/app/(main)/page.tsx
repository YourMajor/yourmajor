import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { HeroSection } from '@/components/landing/HeroSection'
import { LeadChangeChapter } from '@/components/landing/LeadChangeChapter'
import { PosterInterstitial } from '@/components/landing/PosterInterstitial'
import {
  FeatureSplits,
  PowerupBand,
  FeatureBento,
  FeatureList,
} from '@/components/features/FeaturesContent'
import { ShotTracerChapter } from '@/components/landing/ShotTracerChapter'
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
        <PowerupBand />
        <FeatureBento />
        <FeatureList />
      </section>

      <PricingSummary />

      <div className="mk-container">
        <FeaturedTournaments />
        <NearbyTournamentsSection />
      </div>
    </main>
  )
}
