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

      <div className="section-gold-rule max-w-xs mx-auto" />

      <FeaturedTournaments />

      <div className="section-gold-rule max-w-xs mx-auto" />

      <NearbyTournamentsSection />
    </main>
  )
}
