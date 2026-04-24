import Link from 'next/link'
import { FeaturesContent } from '@/components/features/FeaturesContent'

export const metadata = {
  title: 'Features — YourMajor',
  description: 'Everything your golf tournament needs. Live leaderboards, digital scorecards, powerup drafts, and more.',
}

export default function FeaturesPage() {
  return (
    <main className="landing-section-dark">
      {/* Hero */}
      <section className="landing-hero landing-hero-pattern relative overflow-hidden pt-24 sm:pt-36 lg:pt-44 pb-16 sm:pb-20 lg:pb-28">
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-accent mb-3 sm:mb-4 hero-stagger-1">Features</p>
          <h1 className="font-heading text-2xl sm:text-4xl lg:text-6xl font-bold text-white tracking-tight leading-[1.08] hero-stagger-2">
            Everything Your Tournament{' '}
            <span className="text-accent">Needs</span>
          </h1>
          <p className="mt-3 sm:mt-5 text-sm sm:text-base lg:text-lg text-white/60 max-w-xl mx-auto leading-relaxed hero-stagger-3">
            From setup to final scores, YourMajor handles every detail so you can focus on the game.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
             style={{ background: 'linear-gradient(to bottom, transparent, oklch(0.20 0.06 255))' }} />
      </section>

      <FeaturesContent />

      {/* CTA */}
      <section className="py-12 sm:py-16 lg:py-20 text-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold text-white">
            Ready to <span className="text-accent">tee off</span>?
          </h2>
          <p className="text-white/45 mt-3 max-w-md mx-auto">
            Create your first tournament in under a minute. Free to start, no credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold
                bg-accent text-accent-foreground hover:brightness-110 transition-all duration-300"
            >
              Get Started Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-xl border border-white/20 bg-white/5
                px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all duration-300"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
