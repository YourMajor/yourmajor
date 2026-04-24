import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { HeroSection } from '@/components/landing/HeroSection'
import { ValueProposition } from '@/components/landing/ValueProposition'
import { FeaturedTournaments } from '@/components/landing/FeaturedTournaments'
import { NearbyTournamentsSection } from '@/components/landing/NearbyTournamentsSection'

export default async function Home() {
  const user = await getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="landing-section-dark overflow-x-hidden">
      <HeroSection />
      <ValueProposition />

      <div className="mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-12 space-y-10 lg:space-y-12">
        <FeaturedTournaments />
        <NearbyTournamentsSection />
      </div>
    </main>
  )
}
