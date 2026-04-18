import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturedTournaments } from '@/components/landing/FeaturedTournaments'
import { NearbyTournamentsSection } from '@/components/landing/NearbyTournamentsSection'

export default async function Home() {
  const user = await getUser()
  if (user) redirect('/dashboard')

  return (
    <main>
      <HeroSection />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-10">
        <FeaturedTournaments />
        <NearbyTournamentsSection />
      </div>
    </main>
  )
}
