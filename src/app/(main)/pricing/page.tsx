import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { TIER_FEATURES, TIER_NEGATIVES, TIER_PRICES, COMPARISON_FEATURES } from '@/lib/tiers'
import { Check, X, Zap, Trophy, Crown } from 'lucide-react'
import { PricingActions } from './PricingActions'

export const metadata = {
  title: 'Pricing — YourMajor',
  description: 'Simple pricing for casual golf tournaments. Free for up to 16 players.',
}

export default function PricingPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
          Simple pricing for every tournament
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Free for your casual round with friends. Upgrade when you need more players, powerups, or a full season.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Free Tier */}
        <Card className="relative flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Trophy className="w-4 h-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg">Casual Round</CardTitle>
            </div>
            <CardDescription className="min-h-[2.5rem]">Perfect for a round with your crew</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-5">
            <div className="min-h-[4.5rem] flex flex-col justify-center">
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
            <ul className="space-y-2.5">
              {TIER_FEATURES.FREE.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {TIER_NEGATIVES.FREE.length > 0 && (
              <ul className="space-y-2.5 border-t border-border pt-4">
                {TIER_NEGATIVES.FREE.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
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
              <CardTitle className="text-lg">The Major</CardTitle>
            </div>
            <CardDescription className="min-h-[2.5rem]">For bigger events with all the bells and whistles</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-5">
            <div className="min-h-[4.5rem] flex flex-col justify-center">
              <div>
                <span className="font-heading text-4xl font-bold">{TIER_PRICES.PRO.label}</span>
                <span className="text-muted-foreground ml-1">{TIER_PRICES.PRO.description}</span>
              </div>
            </div>
            <PricingActions tier="PRO" />
            <ul className="space-y-2.5">
              {TIER_FEATURES.PRO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {TIER_NEGATIVES.PRO.length > 0 && (
              <ul className="space-y-2.5 border-t border-border pt-4">
                {TIER_NEGATIVES.PRO.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
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
              <CardTitle className="text-lg">The Tour</CardTitle>
            </div>
            <CardDescription className="min-h-[2.5rem]">For leagues and recurring events all season</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 space-y-5">
            <div className="min-h-[4.5rem] flex flex-col justify-center">
              <div>
                <span className="font-heading text-4xl font-bold">{TIER_PRICES.LEAGUE_SEASON.label}</span>
                <span className="text-muted-foreground ml-1">/season</span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                *~$17/month over 12 months
              </span>
            </div>
            <PricingActions tier="LEAGUE" />
            <ul className="space-y-2.5">
              {TIER_FEATURES.LEAGUE.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
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
        <h2 className="font-heading text-xl font-semibold text-center">Compare Plans</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
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
                  <ComparisonCell value={row.tour} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4 max-w-2xl mx-auto">
        <h2 className="font-heading text-xl font-semibold text-center">Frequently Asked Questions</h2>
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
            q="What does the Tour season pass include?"
            a="The $199 Tour pass unlocks everything for 365 days from purchase — unlimited tournaments, season standings, recurring rosters, and all Pro features. No per-tournament fees."
          />
          <FaqItem
            q="What payment methods do you accept?"
            a="All major credit cards, Apple Pay, and Google Pay via Stripe."
          />
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
    <details className="group rounded-lg border border-border px-4 py-3">
      <summary className="cursor-pointer font-heading font-medium text-sm list-none flex items-center justify-between">
        {q}
        <span className="text-muted-foreground transition-transform group-open:rotate-180">&#9662;</span>
      </summary>
      <p className="text-sm text-muted-foreground mt-2">{a}</p>
    </details>
  )
}
