import Link from 'next/link'
import { TIER_FEATURES, TIER_NEGATIVES, TIER_PRICES, COMPARISON_FEATURES } from '@/lib/tiers'
import { Check, X, Zap, Trophy, Crown, Users, type LucideIcon } from 'lucide-react'
import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { PricingActions } from './PricingActions'

export const metadata = {
  title: 'Pricing - YourMajor',
  description: 'Simple pricing for casual golf tournaments. Free for up to 16 players.',
}

/**
 * The pricing surface, on the marketing world's own furniture: bone plates
 * instead of app cards, the broadcast table treatment for the comparison,
 * gold for icons and rules only. Tier identity is told by the plate and its
 * copy, never by a per-tier hue; the marketing world has one accent.
 */

const LABEL = 'mk-label'

type TierDef = {
  key: 'FREE' | 'PRO' | 'CLUB' | 'LEAGUE'
  icon: LucideIcon
  name: string
  desc: string
  price: string
  unit: string
  note?: string
  featured?: boolean
}

const TIERS: TierDef[] = [
  {
    key: 'FREE',
    icon: Trophy,
    name: 'Casual Round',
    desc: 'Perfect for a round with your crew',
    price: '$0',
    unit: 'forever',
  },
  {
    key: 'PRO',
    icon: Zap,
    name: 'The Major',
    desc: 'For bigger events with all the bells and whistles',
    price: TIER_PRICES.PRO.label,
    unit: TIER_PRICES.PRO.description,
    featured: true,
  },
  {
    key: 'CLUB',
    icon: Users,
    name: 'The Club',
    desc: 'For regulars who play multiple events a month',
    price: TIER_PRICES.CLUB.label,
    unit: TIER_PRICES.CLUB.description,
    note: 'Cancel anytime',
  },
  {
    key: 'LEAGUE',
    icon: Crown,
    name: 'The Tour',
    desc: 'Built for golf clubs, organizations, and leagues running events all year',
    price: TIER_PRICES.LEAGUE_SEASON.label,
    unit: '/year',
    note: 'About $167/month over 12 months',
  },
]

function TierPlate({ tier }: { tier: TierDef }) {
  const features = TIER_FEATURES[tier.key]
  const negatives = TIER_NEGATIVES[tier.key] ?? []

  return (
    <div
      className="mk-plate relative flex h-full flex-col p-6"
      style={tier.featured ? { border: '1px solid var(--mk-gold)' } : undefined}
    >
      {/* Out of flow so all four plates keep their CTAs on one line. */}
      {tier.featured && (
        <span
          className={`${LABEL} absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5`}
          style={{
            // Gold-on-bone variant: bright gold text on the bone chip is
            // 2.2:1, well under AA.
            color: 'var(--mk-gold-on-bone)',
            background: 'var(--mk-bone)',
            border: '1px solid var(--mk-gold)',
            borderRadius: 'var(--mk-radius-sm)',
          }}
        >
          Most popular
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <tier.icon className="h-5 w-5" style={{ color: 'var(--mk-gold-on-bone)' }} aria-hidden />
        <h3 className="text-xl" style={{ color: 'var(--mk-ink)' }}>
          {tier.name}
        </h3>
      </div>
      <p className="mt-2 min-h-[3lh] text-sm leading-relaxed" style={{ color: 'var(--mk-over-par)' }}>
        {tier.desc}
      </p>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="mk-data text-4xl" style={{ color: 'var(--mk-ink)' }}>
          {tier.price}
        </span>
        <span className="text-sm" style={{ color: 'var(--mk-over-par)' }}>
          {tier.unit}
        </span>
      </div>
      <p className="mt-1 min-h-[1.25rem] text-xs" style={{ color: 'var(--mk-over-par)' }}>
        {tier.note ?? ''}
      </p>

      <div className="mt-5">
        {tier.key === 'FREE' ? (
          // Primary, like the paid CTAs: free is the entry product, and the
          // one secondary button in the row read as the one to skip.
          <Link href="/auth/signup" className="mk-btn mk-btn-primary-plate w-full">
            Start a free tournament
          </Link>
        ) : (
          <PricingActions tier={tier.key} />
        )}
      </div>

      <ul className="mt-5 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--mk-ink)' }}>
            <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--mk-gold-on-bone)' }} aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {negatives.length > 0 && (
        <ul
          className="mt-4 space-y-2 pt-4"
          style={{ borderTop: '1px solid var(--mk-rule-ink)' }}
        >
          {negatives.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--mk-over-par)' }}>
              <X className="mt-0.5 h-4 w-4 shrink-0 opacity-50" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PricingPage() {
  return (
    <main id="content" className="marketing overflow-x-clip">
      {/* Hero header */}
      <section className="mk-section relative pt-32">
        <div className="mk-container relative z-10 max-w-3xl text-center lg:max-w-4xl">
          <h1>Simple pricing for every tournament</h1>
          <p
            className="mx-auto mt-4 max-w-xl text-base lg:max-w-2xl lg:text-lg"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            Free for your casual round with friends. Upgrade when you need more
            players, powerups, or a full season.
          </p>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--mk-green-deep))' }}
        />
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-10 sm:px-6 lg:max-w-6xl lg:space-y-20 lg:py-14 xl:max-w-7xl">
        {/* Tier plates */}
        <section
          aria-labelledby="plans-heading"
          className="grid grid-cols-1 items-stretch gap-4 pt-2 md:grid-cols-2 lg:grid-cols-4"
        >
          {/* Keeps the heading outline intact (h1 -> h2 -> tier h3s). */}
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          {TIERS.map((tier, i) => (
            <ScrollReveal key={tier.key} direction="up" delay={i * 70} duration={600} className="h-full">
              <TierPlate tier={tier} />
            </ScrollReveal>
          ))}
        </section>

        {/* Comparison table, set as broadcast furniture. */}
        <section aria-labelledby="compare-heading">
          <ScrollReveal direction="up" duration={600}>
            <h2 id="compare-heading" className="text-center">Compare plans</h2>
          </ScrollReveal>
          <div className="mk-plate mt-8 overflow-x-auto">
            <table className="w-full text-sm lg:text-base">
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--mk-green-deep)',
                    borderBottom: '2px solid var(--mk-gold)',
                  }}
                >
                  {/* Headers match the plate names above; "Pro" stays the
                      feature-set term, not a tier name. */}
                  {['Feature', 'Casual', 'Major', 'Club', 'Tour'].map((h, i) => (
                    <th
                      key={h}
                      className={`${LABEL} px-4 py-3 ${i === 0 ? 'text-left' : 'text-center'}`}
                      style={{ color: 'var(--mk-gold)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row) => (
                  <tr key={row.label} style={{ borderBottom: '1px solid var(--mk-rule-ink)' }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--mk-ink)' }}>
                      {row.label}
                    </td>
                    <ComparisonCell value={row.free} />
                    <ComparisonCell value={row.pro} />
                    <ComparisonCell value={row.club} />
                    <ComparisonCell value={row.tour} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className="mx-auto max-w-2xl lg:max-w-3xl">
          <ScrollReveal direction="up" duration={600}>
            <h2 id="faq-heading" className="text-center">Frequently asked questions</h2>
          </ScrollReveal>
          <div className="mt-8 space-y-3">
            <FaqItem
              q="Can I try all features before paying?"
              a="The free Casual Round tier is fully functional for groups up to 16 players. Create a tournament right now, no credit card required."
            />
            <FaqItem
              q="What happens if more than 16 people want to join my free tournament?"
              a="Registration pauses at 16 players. Upgrade to The Major ($29) at any time to unlock up to 72 players. Nothing is lost in the upgrade."
            />
            <FaqItem
              q="Do my players have to pay anything?"
              a="No. Only the tournament organizer pays. Players always join for free."
            />
            <FaqItem
              q="How do Major tournament credits work?"
              a="Each $29 purchase of The Major gives you one tournament credit. Creating a tournament with Major features (branding, powerups, multiple rounds) consumes one credit. Unused credits never expire."
            />
            <FaqItem
              q="What is the Club subscription?"
              a="The Club is a $99/month subscription for organizers running ongoing leagues. You get up to 4 tournaments per month with every Major feature, plus season-long standings, a recurring player roster, sponsor placements on your tournaments, season-over-season player tracking, and 2 admin seats so a co-organizer can help run things. Cancel anytime from your billing page. There is no long-term commitment."
            />
            <FaqItem
              q="What does the Tour annual pass include?"
              a="The $1,999 Tour pass unlocks everything for 365 days from purchase: up to 144 players per event, unlimited tournaments, all Club features (sponsor placements, season standings, season-over-season tracking, recurring rosters), 5 admin seats across your account, a custom subdomain (yourcrew.yourmajor.app), and priority email support. No per-tournament fees."
            />
            <FaqItem
              q="What payment methods do you accept?"
              a="All major credit cards, Apple Pay, and Google Pay via Stripe."
            />
          </div>
        </section>

        {/* Closing beat: the page ends on the action, not on a payment FAQ. */}
        <section aria-label="Get started" className="pb-8 text-center">
          <p
            className="mx-auto max-w-[40ch] text-lg"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            Start with a free round. Upgrade when the field outgrows it.
          </p>
          <Link href="/auth/signup" className="mk-btn mk-btn-primary mt-6">
            Create a tournament
          </Link>
        </section>
      </div>
    </main>
  )
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return (
      <td className="px-4 py-2.5 text-center">
        {value ? (
          <Check className="mx-auto h-4 w-4" style={{ color: 'var(--mk-gold-on-bone)' }} aria-label="Included" />
        ) : (
          <X className="mx-auto h-4 w-4 opacity-40" style={{ color: 'var(--mk-over-par)' }} aria-label="Not included" />
        )}
      </td>
    )
  }
  return (
    <td className="px-4 py-2.5 text-center" style={{ color: 'var(--mk-over-par)' }}>
      {value}
    </td>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details
      className="group px-4 py-3 lg:px-6 lg:py-4"
      style={{
        background: 'var(--mk-green-raised)',
        border: '1px solid var(--mk-rule-light)',
        borderRadius: 'var(--mk-radius-lg)',
      }}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between text-sm font-medium lg:text-base"
        style={{ color: 'var(--mk-text)' }}
      >
        {q}
        <span
          className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
          style={{ color: 'var(--mk-text-subtle)' }}
        >
          &#9662;
        </span>
      </summary>
      <p className="mt-2 text-sm lg:text-base" style={{ color: 'var(--mk-text-muted)' }}>
        {a}
      </p>
    </details>
  )
}
