import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

async function goToTournament(formData: FormData) {
  'use server'
  const slug = (formData.get('slug') as string).trim().toLowerCase()
  if (slug) redirect(`/${slug}`)
}

export function HeroSection() {
  return (
    <section className="landing-hero landing-hero-pattern relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 py-20 sm:py-28 lg:py-36 text-center relative z-10">
        {/* Gold rule above headline */}
        <div className="w-16 h-0.5 bg-accent mx-auto mb-8 rounded-full" />

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
          <Input
            name="slug"
            placeholder="Enter tournament code"
            required
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40
              focus-visible:border-accent focus-visible:ring-accent/30"
          />
          <Button
            type="submit"
            className="bg-accent text-accent-foreground
              hover:bg-accent/90 font-semibold shrink-0"
          >
            Go
          </Button>
        </form>

        {/* Auth CTAs */}
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link
            href="/auth/login"
            className="text-white/60 hover:text-white underline underline-offset-4 transition-colors"
          >
            Sign in
          </Link>
          <span className="text-white/30">or</span>
          <Link
            href="/auth/login"
            className="text-accent hover:text-accent/80 font-semibold underline underline-offset-4 transition-colors"
          >
            Create a tournament
          </Link>
        </div>

        {/* Gold rule below */}
        <div className="w-16 h-0.5 bg-accent mx-auto mt-12 rounded-full" />
      </div>
    </section>
  )
}
