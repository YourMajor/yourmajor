import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, PlusCircle } from 'lucide-react'

async function goToTournament(formData: FormData) {
  'use server'
  const slug = (formData.get('slug') as string).trim().toLowerCase()
  if (slug) redirect(`/${slug}`)
}

export function HeroSection() {
  return (
    <section className="landing-hero landing-hero-pattern relative overflow-hidden">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-20 lg:py-24 text-center relative z-10">
        {/* Main headline */}
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight drop-shadow-md">
          Tournament Golf,{' '}
          <span className="text-accent">Simplified.</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-4 text-base sm:text-lg text-white/90 max-w-lg mx-auto leading-relaxed">
          Live leaderboards, digital scorecards, and powerup drafts &mdash;
          everything your golf group needs, all in one place.
        </p>

        {/* Auth CTAs */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <PlusCircle className="w-4 h-4" />
            Create a tournament
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Tournament code input */}
        <div className="mt-8 max-w-sm mx-auto">
          <p className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">
            Have a code?
          </p>
          <form action={goToTournament} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <Input
                name="slug"
                placeholder="Enter tournament code"
                required
                className="pl-9 bg-white/10 border-white/25 text-white placeholder:text-white/50
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
        </div>
      </div>
    </section>
  )
}
