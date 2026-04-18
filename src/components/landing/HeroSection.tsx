import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

async function goToTournament(formData: FormData) {
  'use server'
  const slug = (formData.get('slug') as string).trim().toLowerCase()
  if (slug) redirect(`/${slug}`)
}

export function HeroSection() {
  return (
    <section className="landing-hero landing-hero-pattern relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24 lg:py-28 text-center relative z-10">
        {/* Main headline */}
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
          Tournament Golf,{' '}
          <span className="text-accent">Simplified.</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-5 text-base sm:text-lg text-white/70 max-w-xl mx-auto leading-relaxed">
          Live leaderboards, digital scorecards, and powerup drafts &mdash;
          everything your golf group needs, all in one place.
        </p>

        {/* Tournament code input */}
        <form action={goToTournament} className="mt-10 flex gap-2 w-full max-w-sm mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              name="slug"
              placeholder="Enter tournament code"
              required
              className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40
                focus-visible:border-accent focus-visible:ring-accent/30"
            />
          </div>
          <Button
            type="submit"
            className="bg-accent text-accent-foreground
              hover:bg-accent/90 font-semibold shrink-0"
          >
            Go
          </Button>
        </form>

        {/* Auth CTAs */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          >
            <Link href="/auth/login">Create a tournament</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
