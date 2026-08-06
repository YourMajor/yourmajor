import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturesContent } from '@/components/features/FeaturesContent'
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

      {/* Features live here now rather than on their own route; /features
          redirects to this anchor. FeaturesContent is reused as-is. */}
      <section id="features" className="mk-section scroll-mt-24">
        <div className="mk-container mb-12">
          <h2>
            Built for <span style={{ color: 'var(--mk-gold)' }}>competitive</span> golfers
          </h2>
          <p className="mt-4 max-w-[65ch] text-base lg:text-lg" style={{ color: 'var(--mk-text-muted)' }}>
            Everything you need to run tournament golf, from casual weekend events
            to season-long leagues.
          </p>
        </div>
        <FeaturesContent />
      </section>

      <PricingSummary />

      <div className="mk-container">
        <FeaturedTournaments />
        <NearbyTournamentsSection />
      </div>
    </main>
  )
}
