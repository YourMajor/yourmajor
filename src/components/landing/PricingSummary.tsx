import Link from 'next/link'
import { TIER_PRICES } from '@/lib/tiers'

/**
 * Tier summary for the landing page. Deliberately a summary, not the pricing
 * page: /pricing keeps the comparison table, the FAQ and the Stripe checkout
 * actions, and six in-app upgrade paths link to it.
 *
 * Prices come from lib/tiers so this can never drift from what is charged.
 */

const TIERS = [
  {
    name: 'Casual Round',
    price: '$0',
    unit: 'forever',
    line: 'Up to 16 players, fully functional, no card required.',
  },
  {
    name: 'The Major',
    price: TIER_PRICES.PRO.label,
    unit: TIER_PRICES.PRO.description,
    line: 'Up to 72 players, powerups, branding and multi-round events.',
    featured: true,
  },
  {
    name: 'The Club',
    price: TIER_PRICES.CLUB.label,
    unit: TIER_PRICES.CLUB.description,
    line: 'Four tournaments a month, season standings and a recurring roster.',
  },
  {
    name: 'The Tour',
    price: TIER_PRICES.LEAGUE_SEASON.label,
    unit: TIER_PRICES.LEAGUE_SEASON.description,
    line: 'Unlimited tournaments, 144 players, and a custom subdomain.',
  },
]

export function PricingSummary() {
  return (
    <section id="pricing" className="mk-section scroll-mt-24">
      <div className="mk-container">
        <h2>Pay for the tournament, not the year</h2>
        <p
          className="mt-4 max-w-[65ch] text-base lg:text-lg"
          style={{ color: 'var(--mk-text-muted)' }}
        >
          Start free and upgrade only when an event outgrows it.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex flex-col p-6"
              style={{
                background: tier.featured ? 'var(--mk-bone)' : 'var(--mk-green-raised)',
                color: tier.featured ? 'var(--mk-ink)' : 'var(--mk-text)',
                border: `1px solid ${tier.featured ? 'var(--mk-gold)' : 'var(--mk-rule-light)'}`,
                borderRadius: 'var(--mk-radius-lg)',
              }}
            >
              <span className="text-sm font-semibold">{tier.name}</span>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="mk-data text-3xl">{tier.price}</span>
                <span
                  className="text-sm"
                  style={{
                    color: tier.featured ? 'var(--mk-over-par)' : 'var(--mk-text-subtle)',
                  }}
                >
                  {tier.unit}
                </span>
              </div>

              <p
                className="mt-4 text-sm leading-relaxed"
                style={{
                  color: tier.featured ? 'var(--mk-over-par)' : 'var(--mk-text-subtle)',
                }}
              >
                {tier.line}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/auth/signup" className="mk-btn mk-btn-primary">
            Create a tournament
          </Link>
          <Link href="/pricing" className="mk-btn mk-btn-secondary">
            Compare all plans
          </Link>
        </div>
      </div>
    </section>
  )
}
