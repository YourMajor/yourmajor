import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { TIER_FEATURES, TIER_NEGATIVES, TIER_PRICES, COMPARISON_FEATURES } from '@/lib/tiers'
import { Check, X, Zap, Trophy, Crown, Users } from 'lucide-react'
import { PricingActions } from './PricingActions'

export const metadata = {
  title: 'Pricing — YourMajor',
  description: 'Simple pricing for casual golf tournaments. Free for up to 16 players.',
}

export default function PricingPage() {
  return (
    <main className="landing-section-dark">
      {/* Hero header */}
      <section className="landing-hero landing-hero-pattern relative overflow-hidden pt-24 sm:pt-32 lg:pt-40 pb-12 sm:pb-16 lg:pb-20">
        <div className="relative z-10 max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-accent mb-3 sm:mb-4 hero-stagger-1">Pricing</p>
          <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight leading-[1.08] hero-stagger-2">
            Simple pricing for every tournament
          </h1>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg text-white/60 max-w-xl lg:max-w-2xl mx-auto hero-stagger-3">
            Free for your casual round with friends. Upgrade when you need more players, powerups, or a full season.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
             style={{ background: 'linear-gradient(to bottom, transparent, oklch(0.20 0.06 255))' }} />
      </section>

      <div className="max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14 space-y-10 lg:space-y-14">

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {/* Free Tier */}
        <Card className="relative flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Trophy className="w-4 h-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg lg:text-xl">Casual Round</CardTitle>
            </div>
            <CardDescription className="min-h-[56px]">Perfect for a round with your crew</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-3">
            <div className="flex flex-col justify-end min-h-[80px]">
              <div>
                <span className="font-heading text-4xl font-bold">$0</span>
                <span className="text-muted-foreground ml-1">forever</span>
              </div>
            </div>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' w-full'}
            >
              Get Started Free
            </Link>
            <ul className="space-y-1.5">
              {TIER_FEATURES.FREE.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm lg:text-base">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {TIER_NEGATIVES.FREE.length > 0 && (
              <ul className="space-y-1.5 border-t border-border pt-4">
                {TIER_NEGATIVES.FREE.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm lg:text-base text-muted-foreground">
                    <X className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pro Tier */}
        <Card className="relative flex flex-col border-2 border-accent overflow-visible">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <Badge className="bg-accent text-accent-foreground">Most Popular</Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-accent" />
              </div>
              <CardTitle className="text-lg lg:text-xl">The Major</CardTitle>
            </div>
            <CardDescription className="min-h-[56px]">For bigger events with all the bells and whistles</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-3">
            <div className="flex flex-col justify-end min-h-[80px]">
              <div>
                <span className="font-heading text-4xl font-bold">{TIER_PRICES.PRO.label}</span>
                <span className="text-muted-foreground ml-1">{TIER_PRICES.PRO.description}</span>
              </div>
            </div>
            <PricingActions tier="PRO" />
            <ul className="space-y-1.5">
              {TIER_FEATURES.PRO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm lg:text-base">
                  <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {TIER_NEGATIVES.PRO.length > 0 && (
              <ul className="space-y-1.5 border-t border-border pt-4">
                {TIER_NEGATIVES.PRO.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm lg:text-base text-muted-foreground">
                    <X className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Club Tier */}
        <Card className="relative flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <CardTitle className="text-lg lg:text-xl">The Club</CardTitle>
            </div>
            <CardDescription className="min-h-[56px]">For regulars who play multiple events a month</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-3">
            <div className="flex flex-col justify-end min-h-[80px]">
              <div>
                <span className="font-heading text-4xl font-bold">{TIER_PRICES.CLUB.label}</span>
                <span className="text-muted-foreground ml-1">{TIER_PRICES.CLUB.description}</span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                Cancel anytime
              </span>
            </div>
            <PricingActions tier="CLUB" />
            <ul className="space-y-1.5">
              {TIER_FEATURES.CLUB.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm lg:text-base">
                  <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {TIER_NEGATIVES.CLUB.length > 0 && (
              <ul className="space-y-1.5 border-t border-border pt-4">
                {TIER_NEGATIVES.CLUB.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm lg:text-base text-muted-foreground">
                    <X className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Tour Tier */}
        <Card className="relative flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Crown className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-lg lg:text-xl">The Tour</CardTitle>
            </div>
            <CardDescription className="min-h-[56px]">Built for golf clubs, organizations, and leagues running events all year</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-3">
            <div className="flex flex-col justify-end min-h-[80px]">
              <div>
                <span className="font-heading text-4xl font-bold">{TIER_PRICES.LEAGUE_SEASON.label}</span>
                <span className="text-muted-foreground ml-1">/year</span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                *~$125/month over 12 months
              </span>
            </div>
            <PricingActions tier="LEAGUE" />
            <ul className="space-y-1.5">
              {TIER_FEATURES.LEAGUE.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm lg:text-base">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Feature Comparison Table */}
      <div className="space-y-4">
        <h2 className="font-heading text-xl lg:text-3xl font-semibold text-center text-white">Compare Plans</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm lg:text-base">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-heading font-semibold">Feature</th>
                <th className="text-center px-4 py-3 font-heading font-semibold">
                  <div className="flex items-center justify-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                    Free
                  </div>
                </th>
                <th className="text-center px-4 py-3 font-heading font-semibold">
                  <div className="flex items-center justify-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-accent" />
                    Pro
                  </div>
                </th>
                <th className="text-center px-4 py-3 font-heading font-semibold">
                  <div className="flex items-center justify-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    Club
                  </div>
                </th>
                <th className="text-center px-4 py-3 font-heading font-semibold">
                  <div className="flex items-center justify-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-primary" />
                    Tour
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                  <td className="px-4 py-2.5 font-medium">{row.label}</td>
                  <ComparisonCell value={row.free} />
                  <ComparisonCell value={row.pro} />
                  <ComparisonCell value={row.club} />
                  <ComparisonCell value={row.tour} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4 max-w-2xl lg:max-w-3xl mx-auto">
        <h2 className="font-heading text-xl lg:text-3xl font-semibold text-center text-white">Frequently Asked Questions</h2>
        <div className="space-y-3">
          <FaqItem
            q="Can I try all features before paying?"
            a="The free tier is fully functional for groups up to 16 players. Create a tournament right now — no credit card required."
          />
          <FaqItem
            q="What happens if more than 16 people want to join my free tournament?"
            a="Registration will pause at 16 players. You can upgrade to Pro ($29) at any time to unlock up to 72 players — no data is lost."
          />
          <FaqItem
            q="Do my players have to pay anything?"
            a="No. Only the tournament organizer pays. Players always join for free."
          />
          <FaqItem
            q="How do Pro tournament credits work?"
            a="Each $29 Pro purchase gives you one tournament credit. When you create a tournament with Pro features (branding, powerups, multi-round, etc.), a credit is consumed. Unused credits never expire."
          />
          <FaqItem
            q="What is the Club subscription?"
            a="The Club is a $99/month subscription that gives you up to 4 tournaments per month with all Pro features. Cancel anytime from your billing page — no long-term commitment."
          />
          <FaqItem
            q="What does the Tour annual pass include?"
            a="The $1,499 Tour pass unlocks everything for 365 days from purchase — unlimited tournaments, season standings, recurring rosters, and all Pro features. No per-tournament fees."
          />
          <FaqItem
            q="What payment methods do you accept?"
            a="All major credit cards, Apple Pay, and Google Pay via Stripe."
          />
        </div>
      </div>
      </div>
    </main>
  )
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return (
      <td className="px-4 py-2.5 text-center">
        {value ? (
          <Check className="w-4 h-4 text-emerald-500 mx-auto" />
        ) : (
          <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
        )}
      </td>
    )
  }
  return <td className="px-4 py-2.5 text-center text-muted-foreground">{value}</td>
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-lg border border-white/10 bg-white/[0.03] px-4 lg:px-6 py-3 lg:py-4">
      <summary className="cursor-pointer font-heading font-medium text-sm lg:text-base text-white list-none flex items-center justify-between">
        {q}
        <span className="text-white/40 transition-transform group-open:rotate-180">&#9662;</span>
      </summary>
      <p className="text-sm lg:text-base text-white/50 mt-2">{a}</p>
    </details>
  )
}
