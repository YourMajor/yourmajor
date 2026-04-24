import { ChevronDown, BarChart3, Trophy, Zap } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="landing-hero landing-hero-pattern relative flex flex-col items-center justify-start overflow-hidden pt-24 sm:pt-36 lg:pt-52 pb-24 sm:pb-32 lg:pb-40">
      {/* Ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 40%, oklch(0.72 0.11 78 / 0.06) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-3xl lg:max-w-4xl mx-auto px-5 sm:px-6 text-center">
        {/* Headline */}
        <h1 className="font-heading text-[1.7rem] sm:text-5xl lg:text-7xl xl:text-8xl font-bold text-white tracking-tight leading-[1.1] hero-stagger-1">
          Tournament Golf,
          <br className="sm:hidden" />
          {' '}<span className="text-accent">Simplified.</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-3 sm:mt-6 text-[13px] sm:text-lg lg:text-xl text-white/75 max-w-xl lg:max-w-2xl mx-auto leading-relaxed hero-stagger-2">
          Live leaderboards, digital scorecards, and powerup drafts — everything your golf group needs.
        </p>

        {/* Feature pills */}
        <div className="mt-5 sm:mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3 hero-stagger-3">
          {[
            { icon: BarChart3, label: 'Leaderboards' },
            { icon: Trophy, label: 'Scorecards' },
            { icon: Zap, label: 'Powerups' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 rounded-full bg-white/8 border border-white/10 text-white/70 text-[10px] sm:text-xs lg:text-sm font-medium">
              <Icon className="w-3 sm:w-3.5 lg:w-4 h-3 sm:h-3.5 lg:h-4 text-accent" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-scroll-hint hero-stagger-4">
        <ChevronDown className="w-5 h-5 text-white/30" />
      </div>

      {/* Bottom gradient fade into content below */}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
           style={{ background: 'linear-gradient(to bottom, transparent, oklch(0.20 0.06 255))' }} />
    </section>
  )
}
